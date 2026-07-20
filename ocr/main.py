from fastapi import FastAPI
from pydantic import BaseModel
import os
import cv2
import numpy as np
import pandas as pd
import pytesseract
import fitz
import json
from anthropic import Anthropic

app = FastAPI()
client = Anthropic()

MOCK_TEXT = (
    "In anul 1834, luna mai, s-au botezat pruncul Ion, fiul lui "
    "Gheorghe Popescu si al Mariei, din satul Valeni."
)

MOCK_ENTITIES = [
    {"tip": "AN", "valoare": "1834"},
    {"tip": "PERSOANA", "valoare": "Ion"},
    {"tip": "PERSOANA", "valoare": "Gheorghe Popescu"},
    {"tip": "LOCALITATE", "valoare": "Valeni"},
]

ENTITY_TYPES = ["PERSOANA", "LOCALITATE", "ORGANIZATIE", "DATA", "AN", "LUNA", "BISERICA", "HRAM"]


class OcrRequest(BaseModel):
    document_id: int
    file_path: str | None = None


def extract_entities_llm(text: str) -> list[dict]:
    prompt = f"""Extrage entitățile numite din următorul text românesc, dintr-un document de patrimoniu bisericesc.
Tipuri posibile: {", ".join(ENTITY_TYPES)}.
Răspunde DOAR cu un array JSON valid, fără text suplimentar, de forma:
[{{"tip": "PERSOANA", "valoare": "..."}}, ...]

Text:
\"\"\"{text[:8000]}\"\"\""""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(raw)
    except Exception as e:
        print(f"LLM extraction failed: {e}")
        return []


def load_document(path: str):
    ext = os.path.splitext(path)[1].lower()

    if ext == ".pdf":
        doc = fitz.open(path)
        pages = []

        for page in doc:
            native_text = page.get_text().strip()

            if len(native_text) > 20:
                pages.append(("text", native_text))
                continue

            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                pix.height, pix.width, pix.n
            )

            if pix.n == 4:
                img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
            elif pix.n == 3:
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

            pages.append(("image", img))

        return pages

    image = cv2.imread(path)
    if image is None:
        raise FileNotFoundError(f"Could not read input file: {path}")

    return [("image", image)]


def get_ocr_text(image: np.ndarray) -> str:
    tess_data = pytesseract.image_to_data(image, lang="ron")
    tess_list = [row.split("\t") for row in tess_data.split("\n")]

    df = pd.DataFrame(tess_list[1:], columns=tess_list[0])
    df.dropna(inplace=True)

    df_clean = df[df["text"].str.strip() != ""]
    content = " ".join(df_clean["text"].tolist())

    return content


def extract_from_path(path: str) -> list[dict]:
    results = []
    for page_number, (kind, payload) in enumerate(load_document(path), start=1):
        if kind == "text":
            text = payload
            source = "pdf_native"
        else:
            text = get_ocr_text(payload)
            source = "ocr_tesseract"

        results.append({"page": page_number, "text": text, "source": source})

    return results


@app.post("/ocr")
def run_ocr(req: OcrRequest) -> dict:
    if req.file_path:
        extracted_pages = extract_from_path(req.file_path)
        full_text = "\n".join(page["text"] for page in extracted_pages)
        entities = extract_entities_llm(full_text)
        engine_name = "tesseract+claude"
    else:
        extracted_pages = []
        full_text = MOCK_TEXT
        entities = MOCK_ENTITIES
        engine_name = "mock"

    return {
        "document_id": req.document_id,
        "engine": engine_name,
        "text": full_text,
        "entities": entities,
        "pages_detail": extracted_pages,
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ocr-llm-ner"}
