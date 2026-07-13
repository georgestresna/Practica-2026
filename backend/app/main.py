import os
import psycopg
from fastapi import FastAPI

app = FastAPI()

DATABASE_URL = os.environ.get("DATABASE_URL", "")

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
