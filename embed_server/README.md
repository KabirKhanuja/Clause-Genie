## Embed Server

This folder contains a small FastAPI based embedding server used by Clause Genie.

### Setup

From the `embed_server` directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Run the server

Start the embed server with uvicorn:

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

The server will be available at `http://localhost:8000`.
