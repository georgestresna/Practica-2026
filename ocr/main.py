from fastapi import FastAPI
from pydantic import BaseModel

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


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ocr-mock"}


@app.post("/ocr")
def run_ocr(req: OcrRequest) -> dict:
    return {
        "document_id": req.document_id,
        "engine": "mock",
        "text": MOCK_TEXT,
        "entities": MOCK_ENTITIES,
    }