import chatService from '../services/chat.service.js';
import logger from '../utils/logger.js';

/**
 * POST /api/chat
 * Body: { sessionId, docId, question }
 * Returns: { answer: string, citations?: [] }
 */
const handleChat = async (req, res, next) => {
  try {
    const { sessionId, docId, question } = req.body || {};
    if (!sessionId || !question) return res.status(400).json({ error: 'missing sessionId or question' });

    const result = await chatService.answerQuestion({ sessionId, docId, question });
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Chat handler error');
    next(err);
  }
};

export default { handleChat };