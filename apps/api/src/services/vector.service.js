import fetch from 'node-fetch';
import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';


// CONFIG
const MODE = (process.env.EMBEDDING_MODE || "local").toLowerCase();
const LOCAL_URL = process.env.EMBEDDING_LOCAL_URL || 'http://127.0.0.1:8000/embed';

logger.info(`VectorService: MODE=${MODE} LOCAL_URL=${LOCAL_URL}`);


// TEXT CHUNKING
export function chunkText(text, opts = {}) {
  const chunkSize = opts.chunkSize || 800;
  const overlap = opts.overlap || 120;

  if (!text || typeof text !== "string") return [];

  const chunks = [];
  let i = 0;

  while (i < text.length) {
    const end = Math.min(text.length, i + chunkSize);
    const c = text.slice(i, end).trim();
    if (c) chunks.push(c);

    if (end === text.length) break;
    i = Math.max(0, end - overlap);
  }

  return chunks;
}


// LOCAL EMBEDDING CALL
export async function embedBatch(texts = []) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const BATCH_SIZE = 16;
  const out = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      if (MODE === 'local') {
        const resp = await fetch(LOCAL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: batch })
        });

        if (!resp.ok) {
          const errTxt = await resp.text().catch(() => "");
          throw new Error(`Local embedding error ${resp.status}: ${errTxt}`);
        }

        const j = await resp.json();
        if (!j || !Array.isArray(j.embeddings)) {
          throw new Error("Local embedding server returned invalid shape");
        }

        for (const emb of j.embeddings) {
          out.push(Array.isArray(emb) ? emb.map(Number) : []);
        }

      } else {
        throw new Error("Cloud embedding mode disabled for this build. Use local mode.");
      }

    } catch (err) {
      logger.error({ err }, "embedBatch failed");
      for (let k = 0; k < batch.length; k++) out.push([]);
    }
  }

  return out;
}


// HELPERS FOR COSINE SIMILARITY
function cosineSimilarity(a = [], b = []) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return -1;

  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const va = Number(a[i]) || 0;
    const vb = Number(b[i]) || 0;

    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }

  if (na === 0 || nb === 0) return -1;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function docChunksKey(sessionId, docId) {
  return `session:${sessionId}:doc:${docId}:chunks`;
}


// UPSERT CHUNKS + EMBEDDINGS
export async function upsertDocChunks(sessionId, docId, chunkTexts = []) {
  if (!sessionId || !docId) throw new Error("missing sessionId or docId");

  const client = await connectRedis();

  const embeddings = await embedBatch(chunkTexts);

  const chunks = chunkTexts.map((text, i) => ({
    chunkId: crypto.randomUUID(),
    text,
    embedding: embeddings[i] || [],
    createdAt: new Date().toISOString()
  }));

  const key = docChunksKey(sessionId, docId);

  await client.set(key, JSON.stringify(chunks), { EX: 24 * 3600 });

  return { docKey: key, inserted: chunks.length };
}


// RETRIEVE & SEARCH
export async function getAllChunksForSession(sessionId) {
  const client = await connectRedis();
  const pattern = `session:${sessionId}:doc:*:chunks`;

  const keys = await client.keys(pattern);
  const out = [];

  for (const k of keys) {
    const raw = await client.get(k);
    if (!raw) continue;

    const docMatch = k.match(/doc:([^:]+):chunks$/);
    const docId = docMatch ? docMatch[1] : null;

    try {
      const arr = JSON.parse(raw);
      for (const c of arr) {
        out.push({
          docId,
          chunkId: c.chunkId,
          text: c.text,
          embedding: c.embedding || []
        });
      }
    } catch (err) {
      logger.warn({ err, key: k }, "Malformed chunks JSON");
    }
  }

  return out;
}


export async function searchSession(sessionId, queryText, topK = 5) {
  if (!queryText) return [];

  const qEmbArr = await embedBatch([queryText]);
  const qEmb = qEmbArr[0] || [];

  const allChunks = await getAllChunksForSession(sessionId);

  const scored = allChunks.map(c => ({
    ...c,
    score: cosineSimilarity(qEmb, c.embedding)
  }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}


// CLEAR
export async function clearDocChunks(sessionId, docId) {
  const client = await connectRedis();
  await client.del(docChunksKey(sessionId, docId));
  return true;
}

// RETURNING DEFAULT EXPORT
export default {
  chunkText,
  embedBatch,
  upsertDocChunks,
  getAllChunksForSession,
  searchSession,
  clearDocChunks
};