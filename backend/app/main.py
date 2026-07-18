import os
import shutil
from pathlib import Path

import httpx
import psycopg
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
OCR_SERVICE_URL = os.environ.get("OCR_SERVICE_URL", "")
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/data/uploads"))


@app.get("/")
def root() -> dict:
    return {"message": "Backend Functional!git branch -M main"}


@app.get("/health")
def health() -> dict:
    try:
        with psycopg.connect(DATABASE_URL, connect_timeout=3) as conn:
            conn.execute("SELECT 1")
        return {"backend": "ok", "database": "ok"}
    except Exception as exc:
        return {"backend": "ok", "database": "down", "error": str(exc)}


@app.get("/ocr-test")
def ocr_test() -> dict:
    try:
        r = httpx.post(f"{OCR_SERVICE_URL}/ocr", json={"document_id": 1}, timeout=10)
        r.raise_for_status()
        return {"backend": "ok", "ocr_response": r.json()}
    except Exception as exc:
        return {"backend": "ok", "ocr": "down", "error": str(exc)}


@app.post("/documente/upload")
def upload_document(file: UploadFile = File(...)) -> dict:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    titlu = file.filename or "document-fara-nume"

    with psycopg.connect(DATABASE_URL, connect_timeout=3) as conn:
        row = conn.execute(
            "INSERT INTO documente (titlu, cale_fisier) VALUES (%s, %s) RETURNING id",
            (titlu, ""),
        ).fetchone()
        doc_id = row[0]

        # Salvam fisierul cu id-ul in nume, ca sa nu se suprascrie doua fisiere cu acelasi nume.
        dest = UPLOAD_DIR / f"{doc_id}_{titlu}"
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
        conn.execute(
            "UPDATE documente SET cale_fisier = %s WHERE id = %s", (str(dest), doc_id)
        )

        # Chemam OCR-ul sincron.
        r = httpx.post(
            f"{OCR_SERVICE_URL}/ocr",
            json={"document_id": doc_id, "file_path": str(dest)},
            timeout=30,
        )
        r.raise_for_status()
        ocr = r.json()

        conn.execute(
            "INSERT INTO text_extras (document_id, continut, motor_ocr) VALUES (%s, %s, %s)",
            (doc_id, ocr["text"], ocr["engine"]),
        )
        for ent in ocr["entities"]:
            conn.execute(
                "INSERT INTO entitati_extrase (document_id, tip, valoare) VALUES (%s, %s, %s)",
                (doc_id, ent["tip"], ent["valoare"]),
            )

    return {"document_id": doc_id, "titlu": titlu, "ocr": ocr}


@app.get("/documente")
def list_documente() -> list[dict]:
    with psycopg.connect(DATABASE_URL, connect_timeout=3) as conn:
        rows = conn.execute(
            "SELECT id, titlu, status, created_at FROM documente ORDER BY id"
        ).fetchall()
    return [
        {"id": r[0], "titlu": r[1], "status": r[2], "created_at": r[3].isoformat()}
        for r in rows
    ]


@app.delete("/documente/{doc_id:int}")
def delete_document(doc_id: int) -> dict:
    with psycopg.connect(DATABASE_URL, connect_timeout=3) as conn:
        row = conn.execute(
            "SELECT cale_fisier FROM documente WHERE id = %s", (doc_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document inexistent")
        cale_fisier = row[0]
        conn.execute("DELETE FROM documente WHERE id = %s", (doc_id,))
    # Stergem si fisierul de pe disc.
    try:
        os.remove(cale_fisier)
    except FileNotFoundError:
        pass
    return {"document_id": doc_id, "deleted": True}


@app.get("/documente/{doc_id:int}")
def get_document(doc_id: int) -> dict:
    with psycopg.connect(DATABASE_URL, connect_timeout=3) as conn:
        doc = conn.execute(
            "SELECT id, titlu, cale_fisier, status FROM documente WHERE id = %s",
            (doc_id,),
        ).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document inexistent")
        texts = conn.execute(
            "SELECT continut, motor_ocr FROM text_extras WHERE document_id = %s",
            (doc_id,),
        ).fetchall()
        ents = conn.execute(
            "SELECT tip, valoare FROM entitati_extrase WHERE document_id = %s",
            (doc_id,),
        ).fetchall()
    return {
        "id": doc[0],
        "titlu": doc[1],
        "cale_fisier": doc[2],
        "status": doc[3],
        "text": [{"continut": t[0], "motor_ocr": t[1]} for t in texts],
        "entitati": [{"tip": e[0], "valoare": e[1]} for e in ents],
    }


class StatusUpdate(BaseModel):
    status: str


class TextUpdate(BaseModel):
    continut: str


@app.patch("/documente/{doc_id:int}/status")
def update_status(doc_id: int, payload: StatusUpdate) -> dict:
    if payload.status not in ("raw", "reviewed", "validated"):
        raise HTTPException(status_code=400, detail="Status invalid")
    with psycopg.connect(DATABASE_URL, connect_timeout=3) as conn:
        row = conn.execute(
            "UPDATE documente SET status = %s WHERE id = %s RETURNING id, status",
            (payload.status, doc_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document inexistent")
    return {"id": row[0], "status": row[1]}


@app.patch("/documente/{doc_id:int}/text")
def update_text(doc_id: int, payload: TextUpdate) -> dict:
    with psycopg.connect(DATABASE_URL, connect_timeout=3) as conn:
        row = conn.execute(
            "UPDATE text_extras SET continut = %s WHERE document_id = %s RETURNING id",
            (payload.continut, doc_id),
        ).fetchone()
        if not row:
            raise HTTPException(
                status_code=404, detail="Text inexistent pentru documentul asta"
            )
    return {"document_id": doc_id, "salvat": True}
