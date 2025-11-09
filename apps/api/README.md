# Clause Genie — API

## Quick start (dev)
1. `cd apps/api`
2. copy `.env` from example and edit
3. `npm install`
4. Start Redis locally: `redis-server` (or use Docker)
5. Start API: `npm run dev`
6. Start worker: `node src/jobs/processor.job.js`

Endpoints:
- `GET /api/health` - health
- `POST /api/upload` - multipart upload (field name `files[]`)
