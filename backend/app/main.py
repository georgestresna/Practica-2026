import os
import psycopg
from fastapi import FastAPI

import httpx

app = FastAPI()

DATABASE_URL = os.environ.get("DATABASE_URL", "")
OCR_SERVICE_URL = os.environ.get("OCR_SERVICE_URL", "")

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