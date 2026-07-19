CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION unaccent_immutable(text)
RETURNS text AS $$
  SELECT unaccent('unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

CREATE TABLE documente (
    id          SERIAL PRIMARY KEY,
    titlu       TEXT NOT NULL,
    cale_fisier TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'raw',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE text_extras (
    id          SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documente(id) ON DELETE CASCADE,
    continut    TEXT NOT NULL,
    motor_ocr   TEXT,
    cautare     tsvector GENERATED ALWAYS AS (to_tsvector('romanian', unaccent_immutable(continut))) STORED
);

CREATE INDEX idx_text_extras_cautare ON text_extras USING GIN (cautare);

CREATE TABLE entitati_extrase (
    id          SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documente(id) ON DELETE CASCADE,
    tip         TEXT NOT NULL,
    valoare     TEXT NOT NULL
);