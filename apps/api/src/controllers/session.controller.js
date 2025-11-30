import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';

/**
 * GET /api/session/:sessionId
 * Returns list of docs for the session with metadata and a small preview (first 300 chars)
 */
const getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'missing sessionId' });

    const client = await connectRedis();

    // this finds all meta keys for this session
    const pattern = `session:${sessionId}:doc:*:meta`;
    const keys = await client.keys(pattern);

    const docs = await Promise.all(
      keys.map(async (metaKey) => {
        const meta = await client.hGetAll(metaKey);
        const docIdMatch = metaKey.match(/doc:([^:]+):meta$/);
        const docId = docIdMatch ? docIdMatch[1] : meta.docId || null;

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

/**
 * GET /api/session/:sessionId/doc/:docId
 * Returns full parsed text if present and simple meta for a single doc
 */
const getDoc = async (req, res, next) => {
  try {
    const { sessionId, docId } = req.params;
    if (!sessionId || !docId) return res.status(400).json({ error: 'missing sessionId or docId' });

    const client = await connectRedis();

    const textKey = `session:${sessionId}:doc:${docId}:text`;
    const metaKey = `session:${sessionId}:doc:${docId}:meta`;

    const [text, meta] = await Promise.all([
      client.get(textKey).catch(() => null),
      client.hGetAll(metaKey).catch(() => ({}))
    ]);

    if (!text && (!meta || Object.keys(meta).length === 0)) {
      return res.status(404).json({ error: 'document not found' });
    }

    return res.json({
      docId,
      text: text || null,
      parsedAt: meta.parsedAt || null,
      status: meta.status || (text ? 'parsed' : 'uploaded'),
      originalname: meta.originalname || '',
      size: meta.size ? Number(meta.size) : null,
      mimetype: meta.mimetype || '',
    });
  } catch (err) {
    logger.error({ err, sessionId: req.params?.sessionId, docId: req.params?.docId }, 'Failed to read document');
    next(err);
  }
};

/**
 * GET /api/session/:sessionId/doc/:docId/file
 * Streams the original uploaded file for preview (if still present on disk)
 */
const getDocFile = async (req, res, next) => {
  try {
    const { sessionId, docId } = req.params;
    if (!sessionId || !docId) return res.status(400).json({ error: 'missing sessionId or docId' });

    const client = await connectRedis();
    const metaKey = `session:${sessionId}:doc:${docId}:meta`;
    const meta = await client.hGetAll(metaKey);

    const filePath = meta?.path;
    if (!filePath) return res.status(404).json({ error: 'file not available' });

    return res.sendFile(filePath, (err) => {
      if (err) {
        return res.status(404).json({ error: 'file not available' });
      }
    });
  } catch (err) {
    logger.error({ err, sessionId: req.params?.sessionId, docId: req.params?.docId }, 'Failed to stream document file');
    next(err);
  }
};

export default { getSession, getDoc, getDocFile };
