import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import vectorService from './vector.service.js'; 


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
  const LLM_API_URL = process.env.LLM_API_URL || process.env.GENERATIVE_API_URL || '';
  const LLM_API_KEY = process.env.LLM_API_KEY || process.env.GENERATIVE_API_KEY || '';
  const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o'; //model

  //THE LLM PROMPT IS HERE

  const promptHeader = `You are Clause-Genie. 
  Answer the user's question using ONLY the provided context excerpts. 
  If the answer is not contained, say you don't know.\n\nQuestion: ${question}\n\nContext excerpts:\n`;

  const ragPrompt = `${promptHeader}\n${contexts}\n\nAnswer:`;

  if (LLM_API_URL && LLM_API_KEY) {
    try {
      const resp = await fetch(LLM_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LLM_API_KEY}`
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          input: ragPrompt,
          max_tokens: 800
        })
      });

      if (resp.ok) {
        const j = await resp.json().catch(() => null);
        let answer = null;
        if (j) {
          if (j.output_text) answer = j.output_text;
          else if (j.answer) answer = j.answer;
          else if (Array.isArray(j.choices) && j.choices[0]) {
            answer = j.choices[0].text || j.choices[0].message?.content || null;
          } else if (j.result) answer = j.result;
          else answer = JSON.stringify(j).slice(0, 4000);
        }
        answer = (answer || 'No answer from LLM').toString();
        const citations = (results || []).map(r => ({ docId: r.docId, chunkId: r.chunkId, score: r.score }));
        return { answer, citations };
      } else {
        const txt = await resp.text().catch(() => `status:${resp.status}`);
        logger.warn({ status: resp.status, text: txt }, 'LLM provider returned non-ok status');
      }
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