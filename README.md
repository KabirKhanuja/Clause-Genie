## System overview 

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

## To run

frontend: cd apps/web
```npm run dev```

backend: start API by cd apps/api
```npm run dev```

in another terminal in the api start worker:
```node src/jobs/processor.job.js```

verify redis: 
```docker exec -it clause-redis redis-cli ping```

to start docker: 
```docker-compose up -d```




## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
