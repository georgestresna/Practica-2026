from fastapi import FastAPI
from pydantic import BaseModel
import os
import cv2
import numpy as np
import pandas as pd
import pytesseract
import fitz
import spacy
import re

app = FastAPI()

nlp = spacy.load("ro_core_news_lg")

LABEL_MAP = {
    "PERSON": "PERSOANA",
    "GPE": "LOCALITATE",
    "LOC": "LOCALITATE",
    "ORG": "ORGANIZATIE",
    "DATE": "DATA",
}

AN_RE = re.compile(r"\b(1[5-9]\d{2}|20[0-2]\d)\b")
LUNA_RE = re.compile(
    r"\b(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|"
    r"septembrie|octombrie|noiembrie|decembrie)\b",
    re.IGNORECASE,
)

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


class OcrRequest(BaseModel):
    document_id: int
    file_path: str | None = None


# NER: spaCy + regex
def extract_entities(text: str) -> list[dict]:
    entities: list[dict] = []

    doc = nlp(text)
    for ent in doc.ents:
        tip = LABEL_MAP.get(ent.label_)
        if tip:
            entities.append({"tip": tip, "valoare": ent.text})

    for m in AN_RE.finditer(text):
        entities.append({"tip": "AN", "valoare": m.group()})

    for m in LUNA_RE.finditer(text):
        entities.append({"tip": "LUNA", "valoare": m.group().lower()})

    return entities


# Incarcare document
def load_document(path: str):

    ext = os.path.splitext(path)[1].lower()

    if ext == ".pdf":
        doc = fitz.open(path)
        pages = []

        for page in doc:
            native_text = page.get_text().strip()

            # Daca pagina are text nativ suficient, il folosim direct (fara OCR)
            if len(native_text) > 20:
                pages.append(("text", native_text))
                continue

            # Altfel, pagina e probabil scanata -> randam ca imagine si o dam la OCR
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

    # Fisier imagine direct
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
        entities = extract_entities(full_text)
    else:
        extracted_pages = []
        full_text = MOCK_TEXT
        entities = MOCK_ENTITIES

    return {
        "document_id": req.document_id,
        "engine": "tesseract+spacy",
        "text": full_text,
        "entities": entities,
        "pages_detail": extracted_pages,
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ocr-ner"}
