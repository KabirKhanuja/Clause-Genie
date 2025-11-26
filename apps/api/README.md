# Clause Genie — API

## Quick start (dev)
1. `cd apps/api`
2. copy `.env` from example and edit
3. `npm install`
4. Start Redis locally: `redis-server` (or use Docker)
5. Start API: `npm run dev`
6. Start Docker: `docker-compose up -d`
7. Start worker: `node src/jobs/processor.job.js`

## Requirements

System:
- Node.js (v18+ recommended, this repo uses Node 22 in CI/dev)
- Redis (server) running locally or reachable remotely (default host `127.0.0.1`, port `6379`)

Installable packages (from `apps/api/package.json`):
- `express` - web framework
- `dotenv` - load environment variables from `.env`
- `cors` - CORS helper
- `multer` - multipart file uploads
- `pdf-parse` - PDF text extraction (CommonJS module)
- `mammoth` - DOCX -> text extraction
- `redis` - Redis client
- `bullmq` - background job queue (requires Redis)
- `morgan` - HTTP request logging middleware
- `pino` - structured logger
- `uuid` - ID generation for sessions/docs

Dev / optional packages:
- `nodemon` - automatic restart in dev
- `pino-pretty` (optional) - pretty-print logs when `USE_PINO_PRETTY=1`

Suggested install (from `apps/api`):
```bash
cd apps/api
npm install
```

Start Redis (examples):
- Homebrew (macOS):
    ```bash
    brew install redis
    brew services start redis
    redis-cli ping # should reply PONG
    ```
- Docker:
    ```bash
    docker run -d --name clause-genie-redis -p 6379:6379 redis:7
    docker exec -it clause-genie-redis redis-cli ping
    ```

Notes:
- `pdf-parse` is a CommonJS package, the worker uses `createRequire` in ESM files to import it.
- OCR for images is not implemented by default; if you need OCR consider installing `tesseract` or `tesseract.js` and adding an OCR step to the worker.
- If you enable pretty logging locally, install `pino-pretty` and run with `USE_PINO_PRETTY=1`.

Native canvas (pdf parsing):
- **Why:** `pdf-parse` (via `pdf.js`) needs browser-like graphics primitives (`DOMMatrix`, `ImageData`, `Path2D`) to render and extract PDF content reliably in Node. Without these, pdf.js emits warnings and some package entrypoints expose only helper utilities instead of the parser.
- **What we use:** `@napi-rs/canvas` : a native, fast canvas implementation that provides the required primitives on Node and avoids the need to install system Cairo libs.
- **Install:**
    ```bash
    cd apps/api
    npm install @napi-rs/canvas
    ```
- **macOS tip:** `@napi-rs/canvas` generally works out-of-the-box on modern macOS. If you run into build errors, ensure you have a recent Xcode toolchain installed (`xcode-select --install`) and that Homebrew packages are up to date. If you prefer the older `canvas` package (which requires Cairo), install Cairo first via Homebrew: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`.
- **Notes:** Once `@napi-rs/canvas` is installed the worker will have the primitives pdf.js expects and the `processor.job.js` loader will be able to initialize the parser (we also added defensive loader logic to handle different `pdf-parse` packaging shapes).

Parsed data storage (metadata & text)
- Metadata key: `session:<sessionId>:doc:<docId>:meta` (Redis hash, contains fields like `docId`, `originalname`, `size`, `mimetype`, `uploadedAt`, `parsedAt`, `status`, `preview`).
- Text key: `session:<sessionId>:doc:<docId>:text` (string containing the extracted text).
- TTL: Both metadata and extracted text are set to expire after `PARSED_TTL_SECONDS` seconds. By default this value is 24 hours (86400 seconds). To change it, set `PARSED_TTL_SECONDS` in your `apps/api/.env`.

Example: check a parsed doc in Redis
```bash
# list keys for a session
redis-cli KEYS "session:<your-session-id>:doc:*:meta"

# view metadata hash
redis-cli HGETALL "session:<your-session-id>:doc:<doc-id>:meta"

# view text and TTL
redis-cli GET "session:<your-session-id>:doc:<doc-id>:text"
redis-cli TTL "session:<your-session-id>:doc:<doc-id>:text"
```


Endpoints:
- `GET /api/health` - health
- `POST /api/upload` - multipart upload (field name `files[]`)

config/         Environment setup, app level constants
controllers/    Business logic per route (upload, query, etc)
routes/         Defines API endpoints and connects to controllers
services/       Core processing (parse, embed, vectorize, etc)
jobs/           Background worker queue (BullMQ)
middleware/     Global middleware (auth, error handler)
utils/          Logger, Redis connection, reusable helpers
uploads/        Temporary local file storage

```mermaid
flowchart TB

    %% ========= CLIENT ========= %%
    subgraph CLIENT["Frontend (Next.js)"]
        UDF["Upload Documents"]
        UQ["User Query"]
    end

    %% ========= API SERVER ========= %%
    subgraph API["Node.js API (Express)"]
        direction TB

        RTE["Routes (/api/upload, /api/query)"]
        CTR["Controllers"]
        MDW["Middleware (auth, error)"]

        SRV_PARSE["Parse Service"]
        SRV_RAG["RAG Service (embed, retrieve)"]

        UPLOAD_DIR["/uploads (temporary files)"]
    end

    %% ========= REDIS ========= %%
    subgraph REDIS["Redis (Cache + Vector Store + Queue Broker)"]
        RS1["session:<id>:docs"]
        RS2["session:<id>:chunks"]
        RS3["session:<id>:vectors (future Redis vector index)"]
        QUEUE["BullMQ Job Queue"]
    end

    %% ========= WORKER ========= %%
    subgraph WORKER["Worker (BullMQ Processor)"]
        JOB_PARSE["Document Parser (PDF/OCR/Text extraction)"]
        JOB_CHUNK["Chunking Engine"]
        JOB_EMB["Embedding Engine (later: nomic-embed-text)"]
    end

    %% ========= LLM ========= %%
    subgraph LLM["Groq LLM"]
        GEN["Answer Generator"]
    end



    %% -------- FLOWS -------- %%

    %% Upload Flow
    UDF --> RTE
    RTE --> CTR
    CTR -->|store temp| UPLOAD_DIR
    CTR -->|enqueue| QUEUE

    QUEUE --> WORKER
    WORKER --> JOB_PARSE
    JOB_PARSE --> JOB_CHUNK
    JOB_CHUNK --> JOB_EMB

    JOB_EMB --> RS2
    JOB_EMB --> RS3
    CTR --> RS1

    %% Query Flow
    UQ --> RTE --> CTR --> SRV_RAG

    SRV_RAG --> RS3
    SRV_RAG --> RS2

    SRV_RAG --> GEN
    GEN -->|response| CLIENT
```

