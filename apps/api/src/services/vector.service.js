import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import { connectRedis } from '../utils/redisClient.js';

/**
 * vector service responsibilities-
 *  chunkText(text): split text into overlapping chunks
 *  getEmbeddings(texts): returns embeddings[][] using configured provider
 *  upsertVectors(sessionId, docId, chunks, embeddings): stores chunk metadata+embedding into redis
 *  searchNearest(sessionId, topK, queryEmbedding): naive KNN over stored vectors for this session
 */

/*  chunking  */
export function chunkText(text, opts = {}) {
  const chunkSize = Number(opts.chunkSize ?? config.rag?.chunkSize ?? 1000);
  const overlap = Number(opts.chunkOverlap ?? config.rag?.chunkOverlap ?? 150);

  if (!text || typeof text !== 'string') return [];

  const chunks = [];
  let start = 0;
  const len = text.length;

  while (start < len) {
    const end = Math.min(start + chunkSize, len);
    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({
        id: uuidv4(),
        text: chunkText,
        start,
        end,
      });
    }
    if (end === len) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

/*  embedding callers  */

/**
 * getEmbeddings(texts: string[])
 * supports three strategies-
 * 1 if EMBED_API_URL env var is set then POST to that URL (body { model, input: [...texts] })
 * 2 if LOCAL_EMBED_HOST is set then call a local embedding service (assumes openai like /v1/embeddings)
 * 3 if OPENAI_API_KEY is set then call openai embeddings endpoint (openai-compatible)
 *
 * returned value: array of embedding arrays (number[])
 */
export async function getEmbeddings(texts = [], opts = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const model = opts.model || config.rag?.embedModel || process.env.EMBED_MODEL || 'text-embedding-3-small';
  const apiUrl = process.env.EMBED_API_URL || null;
  const localHost = process.env.LOCAL_EMBED_HOST || null; // e.g. http://localhost:11434
  const openaiKey = process.env.OPENAI_API_KEY || process.env.GPT_API_KEY || null;

  async function postJson(url, body, headers = {}) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Embedding API error (${res.status}): ${txt}`);
    }
    return res.json();
  }

  // 1) custom EMBED_API_URL (user provided embedding gateway)
  if (apiUrl) {
    const resp = await postJson(apiUrl, { model, input: texts });
    if (Array.isArray(resp?.data)) return resp.data.map((d) => d.embedding);
    if (Array.isArray(resp?.embeddings)) return resp.embeddings;
    if (Array.isArray(resp) && Array.isArray(resp[0])) return resp;
    throw new Error('Unexpected response from EMBED_API_URL');
  }

  // 2) local host (self-hosted embedding server)
  if (localHost) {
    const url = `${localHost.replace(/\/$/, '')}/v1/embeddings`;
    const payload = { model, input: texts };
    const resp = await postJson(url, payload);
    if (Array.isArray(resp?.data)) return resp.data.map((d) => d.embedding);
    if (Array.isArray(resp?.embeddings)) return resp.embeddings;
    throw new Error('Unexpected response from LOCAL_EMBED_HOST');
  }

  // 3) OpenAI-compatible (official API)
  if (openaiKey) {
    const url = `https://api.openai.com/v1/embeddings`;
    const resp = await postJson(url, { model, input: texts }, { Authorization: `Bearer ${openaiKey}` });
    if (Array.isArray(resp?.data)) return resp.data.map((d) => d.embedding);
    if (Array.isArray(resp?.embeddings)) return resp.embeddings;
    throw new Error('Unexpected response from OpenAI embeddings endpoint');
  }

  throw new Error('No embedding provider configured. Set EMBED_API_URL, LOCAL_EMBED_HOST or OPENAI_API_KEY.');
}

/*  Redis vector storage  */

/**
 * upsertVectors(sessionId, docId, chunks, embeddings)
 * sessionId: string
 * docId: string
 * chunks: [{id,text,start,end}]
 * embeddings: number[][] same length as chunks
 *
 * it stores each chunk in redis as hash
 *  key: session:{sessionId}:doc:{docId}:chunk:{chunkId}
 *  fields: id, text, start, end, embedding (JSON), score (optional)
 *
 * Also keeps a set/list of chunk keys for the session+doc to ease retrieval:
 *  key: session:{sessionId}:doc:{docId}:chunks -> SADD each chunkKey
 */
export async function upsertVectors(sessionId, docId, chunks = [], embeddings = []) {
  if (!sessionId || !docId) throw new Error('sessionId and docId required');
  if (!Array.isArray(chunks) || chunks.length === 0) return [];

  const client = await connectRedis();

  const chunkKeys = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const emb = embeddings && embeddings[i] ? embeddings[i] : null;
    const chunkKey = `session:${sessionId}:doc:${docId}:chunk:${c.id}`;
    const fields = {
      id: c.id,
      start: String(c.start ?? 0),
      end: String(c.end ?? 0),
      text: c.text ?? '',
      embedding: emb ? JSON.stringify(emb) : '',
    };
    await client.hSet(chunkKey, fields);
    await client.sAdd(`session:${sessionId}:doc:${docId}:chunks`, chunkKey);
    chunkKeys.push(chunkKey);
  }

  if (config.parsedTtlSeconds) {
    const ttl = Number(config.parsedTtlSeconds);
    for (const k of chunkKeys) {
      await client.expire(k, ttl).catch(() => {});
    }
    await client.expire(`session:${sessionId}:doc:${docId}:chunks`, ttl).catch(() => {});
  }

  return chunkKeys;
}

/*  naive KNN search (Pull all, compute cosine locally)  */

/**
 * computeCosine(a,b) -> number
 */
function computeCosine(a = [], b = []) {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return -1;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = Number(a[i]) || 0;
    const bi = Number(b[i]) || 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return -1;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * searchNearest(sessionId, docId, queryEmbedding, topK)
 * if docId given, search only that doc's chunks; otherwise search whole session
 * my current implementation pulls stored chunk hashes and computes cosine similarity on JS side
 * returns [{chunkKey, docId, chunkId, score, text, start, end}]
 */
export async function searchNearest(sessionId, queryEmbedding, topK = 5, docId = null) {
  if (!sessionId || !Array.isArray(queryEmbedding)) return [];
  const client = await connectRedis();

  let chunkKeys = [];
  if (docId) {
    chunkKeys = await client.sMembers(`session:${sessionId}:doc:${docId}:chunks`).catch(() => []);
  } else {
    const pattern = `session:${sessionId}:doc:*:chunks`;
    const sets = await client.keys(pattern).catch(() => []);
    for (const setKey of sets) {
      const members = await client.sMembers(setKey).catch(() => []);
      chunkKeys.push(...members);
    }
  }

  if (!chunkKeys || chunkKeys.length === 0) return [];

  const results = [];
  for (const chunkKey of chunkKeys) {
    const h = await client.hGetAll(chunkKey).catch(() => ({}));
    if (!h || !h.embedding) continue;
    let emb;
    try {
      emb = JSON.parse(h.embedding);
    } catch (e) {
      continue;
    }
    const score = computeCosine(queryEmbedding, emb);
    results.push({
      chunkKey,
      chunkId: h.id,
      text: h.text,
      start: Number(h.start || 0),
      end: Number(h.end || 0),
      score
    });
  }

  results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return results.slice(0, topK);
}

/* embed and store convenience */

/**
 * embedAndStore(sessionId, docId, text, opts)
 * chunks the text
 * embeds chunks
 * upserts into redis
 * returns chunks array with embeddings
 */
export async function embedAndStore(sessionId, docId, text, opts = {}) {
  const chunks = chunkText(text, opts);
  if (chunks.length === 0) return { chunks: [], embeddings: [] };

  const texts = chunks.map((c) => c.text);
  const embeddings = await getEmbeddings(texts, opts);
  await upsertVectors(sessionId, docId, chunks, embeddings);
  for (let i = 0; i < chunks.length; i++) chunks[i].embedding = embeddings[i] || null;
  return { chunks, embeddings };
}

export default {
  chunkText,
  getEmbeddings,
  upsertVectors,
  searchNearest,
  embedAndStore
};