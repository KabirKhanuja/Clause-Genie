import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import vectorService from './vector.service.js';
import fetch from 'node-fetch';

const LLM_API_URL = process.env.LLM_API_URL || process.env.GENERATIVE_API_URL || '';
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.GENERATIVE_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

async function fetchDocMeta(sessionId, docId) {
  const client = await connectRedis();
  const metaKey = `session:${sessionId}:doc:${docId}:meta`;
  try {
    const meta = await client.hGetAll(metaKey).catch(() => ({}));
    return {
      title: meta.originalname || meta.title || `doc:${docId}`,
      preview: (meta.preview && String(meta.preview).slice(0, 300)) || ''
    };
  } catch (e) {
    return { title: `doc:${docId}`, preview: '' };
  }
}

const CHAT_HISTORY_KEY = (sessionId) => `session:${sessionId}:chat:messages`;

/**
 * storeChatMessage(sessionId, { role: 'user'|'assistant'|'system', content })
 * keeps the list trimmed to maxMessages
 */
export async function storeChatMessage(sessionId, messageObj, opts = { maxMessages: 30 }) {
  if (!sessionId || !messageObj || !messageObj.role || !messageObj.content) return false;
  const client = await connectRedis();
  const key = CHAT_HISTORY_KEY(sessionId);
  const toStore = JSON.stringify({
    role: messageObj.role,
    content: String(messageObj.content),
    ts: new Date().toISOString()
  });
  await client.rPush(key, toStore).catch(() => {});
  if (opts.maxMessages && Number.isInteger(opts.maxMessages)) {
    await client.lTrim(key, -opts.maxMessages, -1).catch(() => {});
  }
  return true;
}

/**
 * getRecentChatMessages(sessionId, maxMessages = 30)
 * returns array of {role, content, ts} in chronological order (oldest -> newest)
 */
export async function getRecentChatMessages(sessionId, maxMessages = 30) {
  const client = await connectRedis();
  const key = CHAT_HISTORY_KEY(sessionId);
  try {
    const len = await client.lLen(key).catch(() => 0);
    const start = Math.max(0, len - maxMessages);
    const arr = await client.lRange(key, start, -1).catch(() => []);
    return arr.map((s) => {
      try {
        return JSON.parse(s);
      } catch (e) {
        return { role: 'user', content: String(s) };
      }
    });
  } catch (err) {
    logger.warn({ err, sessionId }, 'getRecentChatMessages failed');
    return [];
  }
}

async function getLastAssistantMessage(sessionId) {
  try {
    const client = await connectRedis();
    const key = CHAT_HISTORY_KEY(sessionId);
    const len = await client.lLen(key).catch(() => 0);
    if (!len) return null;
    const start = Math.max(0, len - 8);
    const arr = await client.lRange(key, start, -1).catch(() => []);
    for (let i = arr.length - 1; i >= 0; i--) {
      try {
        const o = JSON.parse(arr[i]);
        if (o && o.role === 'assistant' && o.content) return String(o.content || '');
      } catch (e) {
      }
    }
  } catch (e) {
    logger.warn({ err: e, sessionId }, 'getLastAssistantMessage failed');
  }
  return null;
}

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

    const body = {
      model: LLM_MODEL,
      prompt: promptStr,
      max_length: 192, 
      temperature: 0.0
    };

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

  // chit chat
  const GREET_RE = /^(hi|hello|hey|hiya|yo|good (morning|afternoon|evening))[\!\.\s]*$/i;
  const THANKS_RE = /^(thanks|thank you|thx)[\!\.\s]*$/i;
  const BYE_RE = /^(bye|goodbye|see you)[\!\.\s]*$/i;
  const CONFIRM_RE = /^(yes|yep|sure|please do|please|go ahead|ok|okay|ya|y)$/i;

  if (GREET_RE.test(question) || THANKS_RE.test(question) || BYE_RE.test(question)) {
    // Friendly short reply it doesn't call vector/LLM
    const shortReply = GREET_RE.test(question)
      ? `Hi! I'm Clause-Genie. You can ask me about the selected document or say "summarize" / "what's this doc about?".`
      : THANKS_RE.test(question)
        ? `You're welcome! Anything else about the document I can help with?`
        : `Goodbye — feel free to re-open the chat if you need anything.`;

    // record user message + assistant reply to history (you already have storeChatMessage)
    await storeChatMessage(sessionId, { role: 'user', content: question }).catch(()=>{});
    await storeChatMessage(sessionId, { role: 'assistant', content: shortReply }).catch(()=>{});

    return { answer: shortReply, citations: [], pickedDocId: null };
  }
  
  if (CONFIRM_RE.test(question)) {
    await storeChatMessage(sessionId, { role: 'user', content: question }).catch(()=>{});

    const lastAssistant = await getLastAssistantMessage(sessionId);

    const askedForConfirm = lastAssistant && /outside (the )?documents'? scope|I can answer from general knowledge|confirm if you'd like/i.test(lastAssistant);

    if (!askedForConfirm) {
      const follow = `Got it — please tell me which document or question you'd like me to answer now (or re-send your question).`;
      await storeChatMessage(sessionId, { role: 'assistant', content: follow }).catch(()=>{});
      return { answer: follow, citations: [], pickedDocId: null };
    }

    const contexts = (chosenChunks || []).map(r => (r.text || '').slice(0, 512)).join('\n\n');
    const citations = Array.from(new Set((chosenChunks || []).map(r => `session:${sessionId}:doc:${r.docId}#chunk:${r.chunkId}`))).filter(Boolean);

    const systemPromptGeneral = `
You are Clause-Genie. Use the provided document excerpts as helpful context but you MAY use your general knowledge to answer fully.
If you use general knowledge, prefix that portion with: "[NOTE: general-knowledge]".
Keep answers concise and include citations to documents when relevant.
`;

    const userPromptGeneral = `
Context excerpts:
${contexts || '[no relevant excerpts available]'}

User asked previously and asked to "please do" (confirm) — provide a complete answer that can use general knowledge if needed.
`;

    // Call the LLM with combined history + new user prompt (we reuse your existing history fetch)
    const MAX_CHAT_MESSAGES = 30;
    const recent = await getRecentChatMessages(sessionId, MAX_CHAT_MESSAGES);
    const historyMessages = (recent || []).map(m => ({ role: m.role, content: m.content }));

    const messagesForGeneral = [
      { role: 'system', content: systemPromptGeneral },
      ...historyMessages,
      { role: 'user', content: `${userPromptGeneral}\n\nUser Question (repeat): ${question}` }
    ];

    let llmReply = null;
    try {
      const { text } = await callLLM(messagesForGeneral, systemPromptGeneral);
      llmReply = (text || '').toString();
    } catch (e) {
      logger.warn({ err: e, sessionId }, 'General-knowledge LLM call failed');
    }

    const assistantReply = llmReply && llmReply.length > 0
      ? llmReply
      : "I couldn't produce a general-knowledge answer right now; please try again or ask a narrower question.";

    // store assistant reply
    await storeChatMessage(sessionId, { role: 'assistant', content: assistantReply }).catch(()=>{});

    return { answer: assistantReply, citations, pickedDocId: chosenDocId || null };
  }

  // 1) global vector search 
  let globalResults = [];
  try {
    const TOP_K = 3;
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
      const cur = scoreMap.get(d) || { sum: 0, max: -Infinity, count: 0, chunks: [] };
      cur.sum += (r.score || 0);
      cur.count += 1;
      if ((r.score || 0) > cur.max) cur.max = r.score || 0;
      cur.chunks.push(r);
      scoreMap.set(d, cur);
    }

    let best = null;
    for (const [d, stats] of scoreMap.entries()) {
      const weighted = stats.sum * Math.log(1 + stats.count);
      if (!best || weighted > best.weighted) {
        best = { docId: d, stats, weighted };
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

  // 5) build RAG context and structured citations
  const contexts = (chosenChunks || []).map(r => {
    const snippet = (r.text || '').slice(0, 512);
    return `---\n(source: ${r.docId}#${r.chunkId} score=${(r.score||0).toFixed(3)})\n${snippet}`;
  }).join('\n\n');

  // Build structured citations for frontend UI
  const citations = (chosenChunks || []).map(r => ({
    docId: r.docId,
    chunkId: r.chunkId,
    score: r.score || 0,
    snippet: (r.text || '').slice(0, 160)
  }));

  // storing the incoming user message into chat history first
  await storeChatMessage(sessionId, { role: 'user', content: question }).catch(() => {});

  // fetching recent chat history to include in LLM prompt
  const MAX_CHAT_MESSAGES = 30;
  let recent = await getRecentChatMessages(sessionId, MAX_CHAT_MESSAGES);

  // recent is oldest to newest
  let historyMessages = (recent || []).map(m => ({ role: m.role, content: m.content }));

  // built RAG message that we want the model to see
  const ragSystem = `
You are Clause-Genie — an assistant for the user's uploaded documents.
Primary source of truth: the provided document excerpts.

Behavior:
1) FIRST try to answer using ONLY the provided context excerpts. If the answer is fully contained in the context, produce a concise answer and include citations to the exact excerpt(s).
2) If the context does NOT contain the full answer, you MAY use your general knowledge to complete the answer — but you MUST:
   - clearly label any content based on general knowledge with the sentence: "[NOTE: the following is from general knowledge and not present in the provided documents.]"
   - still show any supporting document citations if parts of the answer came from documents.
3) If the user's question is unrelated to the documents' subject, say: "That question is outside the documents' scope; I can answer from general knowledge if you want." and only answer if user confirms.
4) Keep answers short and show source citations in the form in the end of the message not after every point (doc:{docId}#chunk:{chunkId}).
`;

  // context + question
  const ragUser = `Context Excerpts (from documents):\n${contexts}\n\nNow answer the user's latest question using the conversation context below.`;

  // Built full messages array: start with system, then prior convo, then the RAG user message
  const messagesForLLM = [
    { role: 'system', content: ragSystem },
    // includes prior conversation 
    ...historyMessages,

    { role: 'user', content: `${ragUser}\n\nUser Question: ${question}` }
  ];

  // make sure we trim messagesForLLM by character budget so prompts don't explode  like 8k char lol
  const CHAR_LIMIT = 8000;
  function trimMessagesByChars(msgs, limit) {
    const sys = msgs[0];
    const tail = msgs.slice(1); 
    let total = JSON.stringify(sys).length;
    const kept = [];
    for (let i = tail.length - 1; i >= 0; i--) {
      const m = tail[i];
      const len = JSON.stringify(m).length;
      if (total + len > limit) break;
      kept.push(m);
      total += len;
    }
    kept.reverse();
    return [sys, ...kept];
  }

  const messagesTrimmed = trimMessagesByChars(messagesForLLM, CHAR_LIMIT);

  let llmResult = null;
  if (LLM_API_URL) {
    try {
      const { text, raw } = await callLLM(messagesTrimmed, ragSystem);
      llmResult = { text: text || '', raw };
    } catch (e) {
      logger.warn({ err: e, sessionId, chosenDocId: chosenDocId }, 'LLM call failed — falling back to snippet');
    }
  }

  // will append assistant reply to history if we have it (if no LLM, we'll append topSnippet fallback)
  let assistantReply = '';
  if (llmResult && llmResult.text) {
    assistantReply = llmResult.text;
  } else {
    // fallback answer (existing behavior)
    assistantReply = chosenChunks && chosenChunks[0] && chosenChunks[0].text
      ? `Found relevant excerpt(s) — ${chosenChunks[0].text.slice(0, 1200)}`
      : "I couldn't find enough information to answer.";
  }

  // store assistant reply
  await storeChatMessage(sessionId, { role: 'assistant', content: assistantReply }).catch(() => {});

  // finally return
  return { answer: assistantReply, citations, pickedDocId: chosenDocId || null };
}

export default { answerQuestion };