CREATE TABLE documente (
    id SERIAL PRIMARY KEY,
    titlu TEXT NOT NULL,
    cale_fisier TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'raw',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE text_extras (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documente (id) ON DELETE CASCADE,
    continut TEXT NOT NULL,
    motor_ocr TEXT
);

CREATE TABLE entitati_extrase (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documente (id) ON DELETE CASCADE,
    tip TEXT NOT NULL,
    valoare TEXT NOT NULL
);
