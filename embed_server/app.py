from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from sentence_transformers import SentenceTransformer
import numpy as np

app = FastAPI(title="Local Embedding Server")

MODEL_NAME = "sentence-transformers/all-mpnet-base-v2"
model = SentenceTransformer(MODEL_NAME)

class EmbedRequest(BaseModel):
    inputs: List[str]

class EmbedResponse(BaseModel):
    embeddings: List[List[float]]

@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    texts = req.inputs or []
    if len(texts) == 0:
        return {"embeddings": []}
    embs = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
    embeddings = [emb.tolist() for emb in embs]
    return {"embeddings": embeddings}