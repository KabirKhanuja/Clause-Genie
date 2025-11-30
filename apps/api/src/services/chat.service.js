import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';

/**
 * answerquestion - minimal RAG retrieval + simple generation
 * have to replace with real llm later
 */
export async function answerQuestion({ sessionId, docId, question }) {
  const client = await connectRedis();
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

  const context = (text || "").slice(0, 4000);

  if (!context || context.length === 0) {
    return { answer: "I couldn't find parsed text for that document yet. Please wait a moment while parsing completes.", citations: [] };
  }

  let answer = `(dev-mode) I searched the selected document and will answer based on it.\n\nYour question: ${question}\n\nPreview of document context:\n${context.slice(0, 800)}`;

  try {
    const qWords = (question || "").toLowerCase().split(/\W+/).filter(Boolean);
    if (qWords.length > 1) {
      const idx = context.toLowerCase().indexOf(qWords[0]);
      if (idx !== -1) {
        const excerpt = context.slice(Math.max(0, idx - 120), Math.min(context.length, idx + 400));
        answer = `Found a relevant excerpt:\n\n${excerpt}\n\n(Use RAG/LLM to generate a more polished answer)`;
      }
    }
  } catch (e) {
    logger.warn({ e }, 'simple match failed');
  }

  const citations = docId ? [`session:${sessionId}:doc:${docId}`] : [];
  return { answer, citations };
}

export default { answerQuestion };