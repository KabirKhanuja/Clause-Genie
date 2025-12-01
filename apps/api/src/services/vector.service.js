import fetch from 'node-fetch';
import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';


/*
 ive implemented vector store using cloud embeddings + Redis JSON blobs
 it bascially stores chunk arrays under key: session:{sessionId}:doc:{docId}:chunks
 each chunk: { chunkId, text, embedding: [float,...], createdAt }
 */


const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || '';
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || '';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';

if (!EMBEDDING_API_URL || !EMBEDDING_API_KEY) {
  logger.warn('VectorService: EMBEDDING_API_URL and/or EMBEDDING_API_KEY not set. Embedding calls will fail until configured.');
}

/*
 chunkText: naive chunking with overlap
 returns array of strings (chunks)
 */

export function chunkText(text, opts = {}) {
  const chunkSize = opts.chunkSize || 800; 
  const overlap = opts.overlap || 120;
  const chunks = [];
  if (!text || typeof text !== 'string') return chunks;
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

/*
 embedBatch- it calls embedding API for an array of texts
 and returns array of embeddings (Float32Array converted to regular arrays)
 */
export async function embedBatch(texts = []) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  if (!EMBEDDING_API_URL || !EMBEDDING_API_KEY) {
    throw new Error('Embedding API not configured (EMBEDDING_API_URL/EMBEDDING_API_KEY)');
  }

  // basic rate safety that send batches of up to 16 items per request 
  const BATCH_SIZE = 16;
  const outEmbeds = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const body = JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch
      });

      const resp = await fetch(EMBEDDING_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EMBEDDING_API_KEY}`
        },
        body
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Embedding API error ${resp.status}: ${txt}`);
      }

      const j = await resp.json().catch(() => null);

      // provider differences- try common shapes
      //  - { data: [{ embedding: [...] }, ...] }
      //  - { embeddings: [...] }
      //  - { embedding: [...] } for single
      if (j == null) throw new Error('Empty embedding response');

      if (Array.isArray(j.data) && j.data.length === batch.length) {
        for (const item of j.data) {
          if (Array.isArray(item.embedding)) outEmbeds.push(item.embedding.map(Number));
          else if (Array.isArray(item.embeddings)) outEmbeds.push(item.embeddings.map(Number));
          else outEmbeds.push([]);
        }
      } else if (Array.isArray(j.embeddings) && j.embeddings.length === batch.length) {
        for (const e of j.embeddings) outEmbeds.push(Array.isArray(e) ? e.map(Number) : []);
      } else if (Array.isArray(j.embedding) && batch.length === 1) {
        outEmbeds.push(j.embedding.map(Number));
      } else if (Array.isArray(j) && j.length === batch.length) {
        for (const item of j) {
          if (Array.isArray(item.embedding)) outEmbeds.push(item.embedding.map(Number));
          else if (Array.isArray(item)) outEmbeds.push(item.map(Number));
          else outEmbeds.push([]);
        }
      } else {
        logger.warn({ resp: j }, 'embedBatch: unexpected embedding API response shape');
        for (let k = 0; k < batch.length; k++) outEmbeds.push([]);
      }
    } catch (err) {
      logger.error({ err }, 'embedBatch failed');
      for (let k = 0; k < Math.min(BATCH_SIZE, texts.length - i); k++) outEmbeds.push([]);
    }
  }

  return outEmbeds;
}

/*
 cosineSimilarity between two arrays
 */
function cosineSimilarity(a = [], b = []) {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return -1;
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

/**
 upsertDocChunks(sessionId, docId, chunksTexts[])
 chunkTexts: array of strings
 stores chunk objects in Redis under docChunksKey
 
 each stored chunk object:
 {
   chunkId: "<random>",
   text: "...",
   embedding: [...],
   createdAt: ISO
 }
 
 returns: { docKey, inserted: n }
 */
export async function upsertDocChunks(sessionId, docId, chunkTexts = []) {
  if (!sessionId || !docId) throw new Error('missing sessionId or docId');
  const client = await connectRedis();

  const embeddings = await embedBatch(chunkTexts);

  const chunks = chunkTexts.map((txt, idx) => ({
    chunkId: crypto.randomUUID ? crypto.randomUUID() : crypto.createHash('sha1').update(`${Date.now()}-${Math.random()}-${idx}`).digest('hex'),
    text: txt,
    embedding: Array.isArray(embeddings[idx]) ? embeddings[idx] : [],
    createdAt: new Date().toISOString()
  }));

  const key = docChunksKey(sessionId, docId);
  try {
    await client.set(key, JSON.stringify(chunks), { EX: 24 * 3600 }); // TTL 24h (same as parsed data)
    return { docKey: key, inserted: chunks.length };
  } catch (err) {
    logger.error({ err, sessionId, docId }, 'upsertDocChunks failed');
    throw err;
  }
}

/*
 getAllChunks(sessionId)
 returns array of { docId, chunkId, text, embedding }
 */
export async function getAllChunksForSession(sessionId) {
  const client = await connectRedis();
  const pattern = `session:${sessionId}:doc:*:chunks`;
  try {
    const keys = await client.keys(pattern);
    const all = [];
    for (const k of keys) {
      const raw = await client.get(k).catch(() => null);
      if (!raw) continue;
      try {
        const arr = JSON.parse(raw);
        const m = k.match(/session:[^:]+:doc:([^:]+):chunks$/);
        const docId = m ? m[1] : null;
        for (const c of (arr || [])) {
          all.push({
            docId,
            chunkId: c.chunkId,
            text: c.text,
            embedding: c.embedding || []
          });
        }
      } catch (e) {
        logger.warn({ err: e, key: k }, 'Malformed chunk array JSON');
      }
    }
    return all;
  } catch (err) {
    logger.error({ err, sessionId }, 'getAllChunksForSession failed');
    return [];
  }
}

/**
 searchSession(sessionId, queryText, topK = 5)
 embeds the query
 computes cosine similarity to all chunks in the session
 returns topK results sorted by score desc
 */
export async function searchSession(sessionId, queryText, topK = 5) {
  if (!queryText) return [];
  const queryEmbeds = await embedBatch([queryText]);
  const qEmb = queryEmbeds[0] || [];
  if (!qEmb || qEmb.length === 0) return [];

  const all = await getAllChunksForSession(sessionId);
  const scored = [];
  for (const c of all) {
    if (!c.embedding || c.embedding.length === 0) continue;
    const score = cosineSimilarity(qEmb, c.embedding);
    if (score <= 0) continue;
    scored.push({ ...c, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/* clearDocChunks(sessionId, docId) */
export async function clearDocChunks(sessionId, docId) {
  const client = await connectRedis();
  const key = docChunksKey(sessionId, docId);
  await client.del(key).catch(() => {});
  return true;
}

export default {
  chunkText,
  embedBatch,
  upsertDocChunks,
  getAllChunksForSession,
  searchSession,
  clearDocChunks
};