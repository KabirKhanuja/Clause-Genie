import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';

/**
 * GET /api/session/:sessionId
 * Returns list of docs for the session with metadata and a small preview (first 300 chars).
 */
const getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'missing sessionId' });

    const client = await connectRedis();

    // find all meta keys for this session
    const pattern = `session:${sessionId}:doc:*:meta`;
    const keys = await client.keys(pattern);

    const docs = await Promise.all(
      keys.map(async (metaKey) => {
        const meta = await client.hGetAll(metaKey);
        // normalize fields
        const docIdMatch = metaKey.match(/doc:([^:]+):meta$/);
        const docId = docIdMatch ? docIdMatch[1] : meta.docId || null;

        // fetch text preview (first 300 chars) if available
        const textKey = `session:${sessionId}:doc:${docId}:text`;
        let text = await client.get(textKey).catch(() => null);
        let preview = '';
        if (text) {
          preview = text.slice(0, 300);
        } else if (meta.preview) {
          preview = (meta.preview || '').toString().slice(0, 300);
        }

        return {
          docId: meta.docId || docId,
          originalname: meta.originalname || '',
          size: meta.size ? Number(meta.size) : null,
          mimetype: meta.mimetype || '',
          path: meta.path || '',
          status: meta.status || 'uploaded',
          parsedAt: meta.parsedAt || '',
          preview
        };
      })
    );

    res.json({ sessionId, docs });
  } catch (err) {
    logger.error({ err }, 'Failed to read session data');
    next(err);
  }
};

export default { getSession };
