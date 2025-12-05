import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import vectorService from './vector.service.js'; 

const LLM_API_URL = process.env.LLM_API_URL || process.env.GENERATIVE_API_URL || '';
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.GENERATIVE_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

async function callLLM(prompt, systemPrompt = '') {
  if (!LLM_API_URL || !LLM_API_KEY) {
    throw new Error('LLM API URL/KEY not configured');
  }

  const body = {
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: systemPrompt || 'You are Clause-Genie, a helpful legal assistant.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 800,
    temperature: 0.0
  };

  const resp = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => `HTTP ${resp.status}`);
    throw new Error(`LLM provider returned non-ok status: ${txt}`);
  }

  const json = await resp.json();
  let content = null;
  if (Array.isArray(json.choices) && json.choices[0]?.message?.content) {
    content = json.choices[0].message.content;
  } else if (Array.isArray(json.output) && json.output[0]?.content) {
    const c = json.output[0].content;
    content = Array.isArray(c) ? c.map(x => x.text).join('') : c.text || null;
  } else if (Array.isArray(json.result) && json.result[0]?.content) {
    content = json.result[0].content;
  } else {
    content = JSON.stringify(json).slice(0, 2000);
  }

  return { raw: json, text: content }; 
}

export async function answerQuestion({ sessionId, docId, question }) {
  const client = await connectRedis();
  if (!sessionId || !question) return { answer: 'missing sessionId or question', citations: [] };

  // 1) performs vector search 
  let results = [];
  try {
    const TOP_K = 6;
    if (docId) {
      results = await vectorService.searchSession(sessionId, question, TOP_K);
      results = results.filter(r => r.docId === docId);
    }
    if (!results || results.length === 0) {
      results = await vectorService.searchSession(sessionId, question, TOP_K);
    }
  } catch (e) {
    logger.warn({ err: e, sessionId, docId }, 'Vector search failed — falling back');
    results = [];
  }

  // 2) builds context from retrieved chunks
  const contexts = (results || []).map(r => `---\n(source: ${r.docId}#${r.chunkId} score=${(r.score||0).toFixed(3)})\n${r.text}`).join('\n\n');

  // 3) if no vector context, falls back to simple redis based behavior
  if (!contexts || contexts.trim().length === 0) {
    let text = null;
    if (docId) {
      const textKey = `session:${sessionId}:doc:${docId}:text`;
      text = await client.get(textKey).catch(() => null);
    }
    if (!text) {
      const pattern = `session:${sessionId}:doc:*:meta`;
      const keys = await client.keys(pattern);
      for (const metaKey of keys) {
        const m = metaKey.match(/doc:([^:]+):meta$/);
        if (!m) continue;
        const candidateId = m[1];
        const textKey = `session:${sessionId}:doc:${candidateId}:text`;
        text = await client.get(textKey).catch(() => null);
        if (text) {
          docId = candidateId;
          break;
        }
      }
    }

    if (!text || text.length === 0) {
      return { answer: "I couldn't find parsed text for that document yet. Please wait a moment while parsing completes.", citations: [] };
    }

    const snippet = text.slice(0, 2000);
    return {
      answer: `(dev-mode) Couldn't retrieve vector context. Returning best-effort from parsed text:\n\n${snippet}`,
      citations: docId ? [`session:${sessionId}:doc:${docId}`] : []
    };
  }

  // 4) tries calling llm by using env vars, if not configured, fall back to snippet reply.
  const promptHeader = `You are Clause-Genie. Answer the user's question using ONLY the provided context excerpts. If the answer is not contained, say you don't know.\n\nQuestion: ${question}\n\nContext excerpts:\n`;
  const ragPrompt = `${promptHeader}\n${contexts}`;

  if (LLM_API_URL && LLM_API_KEY) {
    try {
      const { text } = await callLLM(ragPrompt);
      const answer = (text || 'No answer from LLM').toString();
      const citations = (results || []).map(r => ({ docId: r.docId, chunkId: r.chunkId, score: r.score }));
      return { answer, citations };
    } catch (e) {
      logger.warn({ err: e }, 'LLM call failed — falling back to snippet reply');
    }
  }

  // 5) last resort lol basic reply from top chunks
  const topSnippet = results[0] && results[0].text ? results[0].text.slice(0, 1800) : '';
  const answer = `Found relevant excerpt(s) — using them to answer:\n\n${topSnippet}\n\n(Enable LLM credentials to generate a more natural answer)`;
  const citations = (results || []).map(r => ({ docId: r.docId, chunkId: r.chunkId, score: r.score }));
  return { answer, citations };
}

export default { answerQuestion };