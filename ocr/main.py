from fastapi import FastAPI
from pydantic import BaseModel
import os
import cv2
import numpy as np
import pandas as pd
import pytesseract
import fitz

app = FastAPI()

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




@app.post("/ocr")
def run_ocr(req: OcrRequest) -> dict:
    if req.file_path:
        extracted_pages = extract_from_path(req.file_path)
        full_text = "\n".join([page["text"] for page in extracted_pages])
    else:
        extracted_pages = []
        full_text = MOCK_TEXT
    return {
        "document_id": req.document_id,
        "engine": "tesseract",
        "text": full_text,
        "entities": MOCK_ENTITIES,
        "pages_detail": extracted_pages
    }

def load_document(path):
    ext = os.path.splitext(path)[1].lower()

    # Procesare PDF
    if ext == '.pdf':
        try:
            import fitz  # PyMuPDF
        except ImportError as exc:
            raise ImportError(
                'PDF support requires PyMuPDF. Install it with `pip install pymupdf`.'
            ) from exc

        doc = fitz.open(path)
        images = []

        for page in doc:
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

            if pix.n == 4:
                img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
            elif pix.n == 3:
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

            images.append(img)

        return images

    # Procesare Imagine
    image = cv2.imread(path)
    if image is None:
        raise FileNotFoundError(f'Could not read input file: {path}')

    return [image]

def get_ocr_text(image):
    tessData = pytesseract.image_to_data(image)
    tessList = list(map(lambda x: x.split('\t'), tessData.split('\n')))
    
    df = pd.DataFrame(tessList[1:], columns=tessList[0])
    df.dropna(inplace=True)
    
    # strip la spatii
    df_clean = df[df['text'].str.strip() != '']
    content = " ".join(df_clean['text'].tolist())
    
    return content

def extract_from_path(path):
    results = []
    for page_number, image in enumerate(load_document(path), start=1):
        text = get_ocr_text(image)
        results.append({
            'page': page_number,
            'text': text
        })
    return results

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ocr-mock"}