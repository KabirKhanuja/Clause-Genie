import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import vectorService from './vector.service.js';
import fetch from 'node-fetch';

const LLM_API_URL = process.env.LLM_API_URL || process.env.GENERATIVE_API_URL || '';
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.GENERATIVE_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

async function fetchWithLocalRetry(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (err && err.code === 'ECONNREFUSED' && typeof url === 'string' && url.includes('localhost')) {
      const alt = url.replace('localhost', '127.0.0.1');
      return await fetch(alt, options);
    }
    throw err;
  }
}

/**
 callLLM: supports both local Ollama and cloud JSON APIs
 if LLM_API_URL looks like local ollama (localhost:11434) we'll call /api/generate with { model, prompt }
 otherwise we'll have to send { model, messages } (standard chat API) and parse response
 promptOrMessages may be:
 - string (single prompt)
 - array of {role, content} (chat messages)
 */
async function callLLM(promptOrMessages, systemPrompt = '') {
  if (!LLM_API_URL) throw new Error('LLM API URL not configured');

  const isMessages = Array.isArray(promptOrMessages);

  const isLocalOllama = LLM_API_URL.includes('11434') || LLM_API_URL.includes('ollama') || !LLM_API_KEY;

  if (isLocalOllama) {
    let promptStr = '';
    if (isMessages) {
      promptStr = promptOrMessages.map(m => `${(m.role || 'user').toUpperCase()}:\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}\n`).join('\n');
    } else {
      promptStr = String(promptOrMessages || '');
    }
    if (systemPrompt && String(systemPrompt).trim()) {
      promptStr = `SYSTEM:\n${systemPrompt}\n\n${promptStr}`;
    }

    const body = { model: LLM_MODEL, prompt: promptStr };

    const resp = await fetchWithLocalRetry(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(LLM_API_KEY ? { Authorization: `Bearer ${LLM_API_KEY}` } : {})
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => `HTTP ${resp.status}`);
      throw new Error(`Local LLM returned non-ok status: ${txt}`);
    }

    const rawText = await resp.text();
    const lines = rawText.split(/\r?\n/).filter(Boolean);

    let full = '';
    const parsed = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        parsed.push(obj);
        if (obj.response) full += String(obj.response);
        else if (obj.output && typeof obj.output === 'string') full += obj.output;
        else if (obj.text && typeof obj.text === 'string') full += obj.text;
      } catch (e) {
        full += line + '\n';
      }
    }

    return { raw: parsed, text: full.trim() };
  } else {
    let payload;
    if (isMessages) {
      payload = { model: LLM_MODEL, messages: promptOrMessages, max_tokens: 800, temperature: 0.0 };
    } else {
      payload = {
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt || 'You are Clause-Genie, a helpful assistant.' },
          { role: 'user', content: String(promptOrMessages || '') }
        ],
        max_tokens: 800,
        temperature: 0.0
      };
    }

    const resp = await fetchWithLocalRetry(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(LLM_API_KEY ? { Authorization: `Bearer ${LLM_API_KEY}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => `HTTP ${resp.status}`);
      throw new Error(`LLM provider returned non-ok status: ${txt}`);
    }

    const json = await resp.json().catch(() => null);

    let content = null;
    if (json == null) {
      content = '';
    } else if (Array.isArray(json.choices) && json.choices[0]?.message?.content) {
      content = json.choices.map(c => c.message?.content).join('\n');
    } else if (Array.isArray(json.output) && json.output[0]?.content) {
      const c = json.output[0].content;
      content = Array.isArray(c) ? c.map(x => x.text).join('') : c.text || '';
    } else if (json.result && Array.isArray(json.result) && json.result[0]?.content) {
      content = json.result[0].content;
    } else if (json.choices && json.choices[0]?.text) {
      content = json.choices.map(c => c.text).join('\n');
    } else {
      content = JSON.stringify(json).slice(0, 8000);
    }

    return { raw: json, text: (content || '').toString().trim() };
  }
}

/**
 * answerQuestion: main RAG + LLM orchestration
 * returns { answer, citations, pickedDocId }
 */
export async function answerQuestion({ sessionId, docId: explicitDocId, question }) {
  const client = await connectRedis();
  if (!sessionId || !question) return { answer: 'missing sessionId or question', citations: [] };

  // 1) global vector search
  let globalResults = [];
  try {
    const TOP_K = 12;
    globalResults = await vectorService.searchSession(sessionId, question, TOP_K);
  } catch (e) {
    logger.warn({ err: e, sessionId, docId: explicitDocId }, 'Vector search across session failed');
    globalResults = [];
  }

  // 2) pick doc (explicit or aggregated best)
  let chosenDocId = explicitDocId || null;
  let chosenChunks = [];

  if (chosenDocId) {
    chosenChunks = (globalResults || []).filter(r => r.docId === chosenDocId);
  }

  if (!chosenDocId) {
    const scoreMap = new Map();
    for (const r of (globalResults || [])) {
      const d = r.docId || 'unknown';
      const cur = scoreMap.get(d) || { sum: 0, max: -Infinity, count: 0 };
      cur.sum += (r.score || 0);
      cur.count += 1;
      if ((r.score || 0) > cur.max) cur.max = r.score || 0;
      scoreMap.set(d, cur);
    }

    let best = null;
    for (const [d, stats] of scoreMap.entries()) {
      if (!best) { best = { docId: d, stats }; continue; }
      const b = best.stats;
      if (stats.sum > b.sum || (stats.sum === b.sum && stats.max > b.max)) {
        best = { docId: d, stats };
      }
    }
    if (best) {
      chosenDocId = best.docId;
      chosenChunks = (globalResults || []).filter(r => r.docId === chosenDocId);
    }
  }

  // 3) fallback to top global results if needed
  if ((!chosenChunks || chosenChunks.length === 0) && globalResults && globalResults.length > 0) {
    chosenChunks = globalResults.slice(0, 6);
    if (!chosenDocId && chosenChunks.length > 0) chosenDocId = chosenChunks[0].docId;
  }

  // 4) if still nothing, fallback to parsed text in redis
  if (!chosenChunks || chosenChunks.length === 0) {
    let text = null;
    if (explicitDocId) {
      const textKey = `session:${sessionId}:doc:${explicitDocId}:text`;
      text = await client.get(textKey).catch(() => null);
      if (text) chosenDocId = explicitDocId;
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
          chosenDocId = candidateId;
          break;
        }
      }
    }

    if (!text || text.length === 0) {
      return { answer: "I couldn't find parsed text for that document yet. Please wait a moment while parsing completes.", citations: [], pickedDocId: null };
    }

    const snippet = text.slice(0, 2000);
    return {
      answer: `(dev-mode) Couldn't retrieve vector context. Returning best-effort from parsed text:\n\n${snippet}`,
      citations: chosenDocId ? [`session:${sessionId}:doc:${chosenDocId}`] : [],
      pickedDocId: chosenDocId || null
    };
  }

  // 5) build RAG context and citations
  const contexts = (chosenChunks || []).map(r => `---\n(source: ${r.docId}#${r.chunkId} score=${(r.score||0).toFixed(3)})\n${r.text}`).join('\n\n');
  const citations = Array.from(new Set((chosenChunks || []).map(r => `session:${sessionId}:doc:${r.docId}#chunk:${r.chunkId}`))).filter(Boolean);

  // 6) prepare prompts
  const systemPrompt = `
You are Clause-Genie.
Primary source of truth: the provided document excerpts.

Rules:
1) If the user's question can be answered fully from the provided context → answer ONLY using the context (quote or cite snippets).
2) If the context is insufficient → use general knowledge but indicate that the answer is from general knowledge.
3) If the question is unrelated to the context → politely only state that "I can only answer questions related to the provided excerpts."
4) Keep answers concise and highlight source citations when applicable. 
5) Provide answers to certain heavy questions in bullet points for clarity.
`;

  const userPrompt = `
User Question: ${question}

Context Excerpts:
${contexts}

Answer the question. If context is insufficient, extend using your own knowledge and clearly state so.
`;

  // 7) call LLM if configured
  if (LLM_API_URL) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const { text } = await callLLM(messages, systemPrompt);
      const answer = (text || 'No answer from LLM').toString();
      return { answer, citations, pickedDocId: chosenDocId || null };
    } catch (e) {
      logger.warn({ err: e, sessionId, chosenDocId }, 'LLM call failed — falling back to top chunk snippet');
    }
  }

  // 8) final fallback - return top chunk snippet
  const topSnippet = chosenChunks[0] && chosenChunks[0].text ? chosenChunks[0].text.slice(0, 1800) : '';
  return {
    answer: `Found relevant excerpt(s) — using them to answer:\n\n${topSnippet}\n\n(Enable LLM credentials or local Ollama to generate a more natural answer)`,
    citations,
    pickedDocId: chosenDocId || null
  };
}

export default { answerQuestion };