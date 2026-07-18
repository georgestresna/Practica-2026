# Demo Aplicatie Biserici

Platforma de digitizare a arhivelor bisericesti: upload documente, OCR/HTR, extragere entitati (NER), validare manuala, chatbot RAG.

Starea actuala: **schelet functional**. Fluxul upload -> salvare -> OCR -> baza de date merge cap-coada, dar OCR-ul intoarce date mock (false). Toate containerele exista si comunica.

---

## Stack

| Serviciu      | Tehnologie            | Port host | Descriere                     |
| ------------- | --------------------- | --------- | ----------------------------- |
| `frontend`    | nginx + HTML/JS       | 3000      | interfata minima de test      |
| `backend`     | FastAPI (Python 3.12) | 8000      | API principal                 |
| `ocr-service` | FastAPI (Python 3.12) | 8001      | OCR/HTR - **mock deocamdata** |
| `db`          | PostgreSQL 16         | 5432      | metadate + text extras        |

Fisierele urcate ajung in `./uploads/` (bind mount local). Nu folosim object storage inca.

---

## Setup

Ai nevoie de Docker si Docker Compose.

```bash
git clone <url-repo>
cd practica
chmod +x run.sh

sudo ./run.sh
```

Verifica ca totul e sus:

Puncte de acces:

- http://localhost:3000 - interfata
- http://localhost:8000/docs - Swagger UI (toate API-urile, cu buton de test)
- http://localhost:8001/docs - Swagger UI serviciu OCR

### `run.sh`

```bash
docker compose down --remove-orphans   # opreste, curata orfanii (volumele RAMAN)
docker image prune -f                  # sterge imaginile dangling
docker compose up --build              # rebuild + pornire
```

---

## Drumul datelor

La `POST /documente/upload`:

1. **client -> backend** (`localhost:8000`) - trimite fisierul
2. **backend -> db** (`db:5432`) - `INSERT INTO documente`, primeste `id`
3. **backend -> disc** - salveaza fisierul ca `/data/uploads/{id}_{nume}` (= `./uploads/` pe host), apoi `UPDATE cale_fisier`
4. **backend -> ocr-service** (`http://ocr-service:8001/ocr`) - trimite `document_id`, primeste text + entitati
5. **backend -> db** - `INSERT` in `text_extras` si `entitati_extrase`
6. **backend -> client** - JSON cu `document_id` si rezultatul OCR

Totul e **sincron**: clientul asteapta pana termina OCR-ul.

### Cine vorbeste cu cine

| De la   | La          | Adresa             | Protocol     |
| ------- | ----------- | ------------------ | ------------ |
| host    | frontend    | `localhost:3000`   | HTTP         |
| host    | backend     | `localhost:8000`   | HTTP         |
| host    | db          | `localhost:5432`   | psql         |
| backend | db          | `db:5432`          | psycopg      |
| backend | ocr-service | `ocr-service:8001` | HTTP (httpx) |
| backend | disc        | `/data/uploads`    | bind mount   |

**Important:** intre containere se comunica prin **numele serviciului din compose** + **portul intern** (`db:5432`, nu `localhost:5432`). Maparile `ports:` exista doar ca sa ajungem noi de pe host.

`ocr-service` nu atinge baza de date - primeste un id, intoarce date. Backend-ul persista.

---

## Baza de date

Trei tabele (`db/init/01-create_tables.sql`):

**`documente`** - un rand per fisier urcat

- `id`, `titlu`, `cale_fisier`, `status` (`raw` / `reviewed` / `validated`), `created_at`

**`text_extras`** - transcrierea OCR

- `document_id` (FK), `continut`, `motor_ocr`

**`entitati_extrase`** - entitatile NER

- `document_id` (FK), `tip` (`AN`, `PERSOANA`, `LOCALITATE`), `valoare`

Relatie: un document -> o transcriere -> mai multe entitati, legate prin `document_id` (`ON DELETE CASCADE`).

### Atentie: schema si volume

Scripturile din `db/init/` ruleaza **doar cand volumul e gol**. Daca modifici schema:

```bash
docker compose down -v   # sterge volumul => PIERZI DATELE
./run.sh
```

`down` (fara `-v`) pastreaza datele. `down -v` le sterge. `run.sh` foloseste `down` simplu.

Fisierele din `./uploads/` NU sunt in volum - raman pe disc si dupa `down -v`. Deci vei avea fisiere orfane fara rand in baza. Nu e un bug, doar sa stiti de ce.

---

## API

| Metoda | Ruta                | Ce face                              |
| ------ | ------------------- | ------------------------------------ |
| GET    | `/`                 | mesaj de test                        |
| GET    | `/health`           | verifica conexiunea la db            |
| GET    | `/ocr-test`         | verifica ca ocr-service raspunde     |
| POST   | `/documente/upload` | urca fisier -> salveaza -> OCR -> db |
| GET    | `/documente`        | lista documentelor                   |
| GET    | `/documente/{id}`   | document + text + entitati           |
| DELETE | `/documente/{id}`   | stergere document incarcat           |

Din browser la `localhost:8000/docs` (are buton de upload).

Serviciul OCR (`ocr-service`), apelat de backend:

- `GET /health`
- `POST /ocr` - primeste `{"document_id": int}`, intoarce `{text, entities, engine}`

**Contractul asta ramane cand implementam OCR-ul real.** Se schimba doar interiorul lui `ocr-service`; backend-ul nu observa diferenta.

---

---

## Ce mai trebuie facut

**Urmatorii pasi:**

- [ ] **OCR real** - inlocuim mock-ul cu Tesseract si/sau TrOCR. Ambele gratis, de testat pe scanari reale. API ramane identic.
- [ ] **NER real** - extragere entitati din textul transcris
- [ ] **CI/CD** - GitHub Actions: lint + `docker compose build` la fiecare push

**Dupa:**

- [ ] **Validare manuala** - endpoint + UI pentru `raw` -> `reviewed` -> `validated` (human-in-the-loop)
- [ ] **RAG + Qdrant** - chunking, embeddings, chatbot
- [ ] **Tabel `biserica`** - momentan schema e simplificata, fara relatia document -> biserica
- [ ] **Object storage (MinIO)** - inlocuieste `./uploads/`, cand volumul de fisiere o cere
- [ ] **OCR asincron** - acum e sincron; cu Tesseract real pe scanari mari, clientul ar astepta 30+ secunde

**Datorii tehnice cunoscute:**

- credentialele sunt in `.env` comis local, plain text - de mutat cand apare primul secret real
- fara healthcheck-uri / `depends_on` - la pornire, backend-ul poate incerca db-ul inainte sa fie gata
- fara teste
