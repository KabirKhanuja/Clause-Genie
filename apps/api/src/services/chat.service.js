import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import vectorService from './vector.service.js'; 


export async function answerQuestion({ sessionId, docId, question }) {
  const client = await connectRedis();

  if (!sessionId || !question) {
    return { answer: 'missing sessionId or question', citations: [] };
  }

  // 1) if a docId selected, prefer searching within that doc. Otherwise search all session docs.
  const TOP_K = 6;
  let results = [];
  try {
    if (docId) {
      results = await vectorService.searchSession(sessionId, question, TOP_K);
      // filter to selected doc only (searchSession returns doc-scoped results already)
      results = results.filter(r => r.docId === docId);
    }
    // if no docId or no results, broaden to whole session
    if ((!results || results.length === 0)) {
      results = await vectorService.searchSession(sessionId, question, TOP_K);
    }
  } catch (e) {
    console.warn('vector search failed', e);
    results = [];
  }

  const contexts = (results || [])
    .map(r => `---\n(source: ${r.docId}#${r.chunkId} score=${r.score.toFixed(3)})\n${r.text}`)
    .join('\n\n');

  // PROMPT FOR THE LLMS
  const promptHeader =
    `You are Clause-Genie. Answer the user's question using ONLY the provided context excerpts. ` +
    `If the answer is not contained, say you don't know and optionally suggest where to look.\n\n` +
    `Question: ${question}\n\nContext excerpts:\n`;
  const ragPrompt = `${promptHeader}\n${contexts}\n\nAnswer:`;

  // if no context found, fallback to earlier behavior
  if (!contexts || contexts.trim().length === 0) {
    // fallback try to find parsed text in redis that is the older approach
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
      return {
        answer: "I couldn't find parsed text for that document yet. Please wait a moment while parsing completes.",
        citations: []
      };
    }
    const snippet = text.slice(0, 1800);
    return {
      answer: `(dev-mode) I couldn't retrieve vector context. Showing best-effort from parsed text:\n\n${snippet}`,
      citations: docId ? [`session:${sessionId}:doc:${docId}`] : []
    };
  }

  // 2) try calling configured LLM  and env driven config
  const LLM_API_URL = process.env.LLM_API_URL || process.env.GENERATIVE_API_URL || '';
  const LLM_API_KEY = process.env.LLM_API_KEY || process.env.GENERATIVE_API_KEY || '';
  const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o'; // model

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
          // this body shape is fairly generic; adapt keys to your provider like input/messages/etc.
          input: ragPrompt,
          max_tokens: 800
        })
      });

      if (resp.ok) {
        const j = await resp.json().catch(() => null);
        // parse provider variations: prefer j.output_text, j.answer, j.choices[0].text, j.content
        let answer = null;
        if (j) {
          if (j.output_text) answer = j.output_text;
          else if (j.answer) answer = j.answer;
          else if (Array.isArray(j.choices) && j.choices[0] && (j.choices[0].text || j.choices[0].message)) {
            answer = j.choices[0].text || j.choices[0].message?.content || null;
          } else if (j.result) answer = j.result;
          else answer = JSON.stringify(j).slice(0, 4000);
        }
        answer = (answer || 'No answer from LLM').toString();

        const citations = (results || []).map(r => ({ docId: r.docId, chunkId: r.chunkId, score: r.score }));
        return { answer, citations };
      } else {
        const txt = await resp.text().catch(() => `status:${resp.status}`);
        console.warn('LLM call failed', txt);
      }
    } catch (e) {
      console.warn('LLM call error', e);
    }
  }

  // 3) if LLM not configured or call failed it will synthesize a basic reply from top chunks
  const topSnippet = (results[0] && results[0].text) ? results[0].text.slice(0, 1500) : '';
  const answer =
    `Found relevant excerpt(s) — using them to answer:\n\n${topSnippet}\n\n` +
    `(Enable LLM credentials to generate a better, natural-language answer.)`;
  const citations = (results || []).map(r => ({ docId: r.docId, chunkId: r.chunkId, score: r.score }));

  return { answer, citations };
}

export default { answerQuestion };