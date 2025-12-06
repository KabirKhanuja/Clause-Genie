import chatService from '../services/chat.service.js';
import logger from '../utils/logger.js';

/**
 * POST /api/chat
 * Body: { sessionId, docId, question, useGeneralKnowledge }
 * Returns: { answer: string, citations?: [], pickedDocId?: string }
 */
const handleChat = async (req, res, next) => {
  try {
    const { sessionId, docId, question, useGeneralKnowledge } = req.body || {};
    if (!sessionId || !question) {
      return res.status(400).json({ error: 'missing sessionId or question' });
    }

    logger.info({ sessionId, docId, useGeneralKnowledge }, 'Chat request received');

    const result = await chatService.answerQuestion({
      sessionId,
      docId,
      question,
      useGeneralKnowledge,
    });
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Chat handler error');
    next(err);
  }
};

export default { handleChat };