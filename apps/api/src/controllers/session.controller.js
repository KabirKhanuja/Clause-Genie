import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import config from '../config/index.js';

/**
 * GET /api/session/:sessionId
 * Returns list of docs for the session with metadata and a small preview (first 300 chars)
 */
const getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'missing sessionId' });

    const client = await connectRedis();

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
 * Streams the original uploaded file (if available on disk).
 */
const getDocFile = async (req, res, next) => {
  try {
    const { sessionId, docId } = req.params;
    if (!sessionId || !docId) return res.status(400).json({ error: 'missing sessionId or docId' });

    const client = await connectRedis();
    const metaKey = `session:${sessionId}:doc:${docId}:meta`;
    const meta = await client.hGetAll(metaKey).catch(() => ({}));

    if (!meta || Object.keys(meta).length === 0) {
      return res.status(404).json({ error: 'document not found' });
    }

    // If server-side HTML preview exists in Redis, return it directly
    if (meta.fileHtml) {
      try {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(meta.fileHtml);
        return;
      } catch (err) {
        logger.error({ err, sessionId, docId }, 'Failed to send HTML preview');
        return res.status(500).json({ error: 'failed to serve HTML preview' });
      }
    }

    const filePath = meta.path || meta.filePath || '';
    if (!filePath) {
      return res.status(404).json({ error: 'file not available' });
    }

    try {
      await fsPromises.access(filePath, fs.constants.R_OK);
    } catch (err) {
      return res.status(404).json({ error: 'file not available' });
    }

    const mime = meta.mimetype || 'application/octet-stream';
    const filename = meta.originalname || path.basename(filePath);

    res.setHeader('Content-Type', mime);
    const disposition = mime === 'application/pdf' || mime.startsWith('image/') ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`);

    const readStream = fs.createReadStream(filePath);
    readStream.on('error', (err) => {
      logger.error({ err, sessionId, docId, filePath }, 'Failed streaming file');
      if (!res.headersSent) res.status(500).json({ error: 'file read error' });
    });

    readStream.pipe(res);
  } catch (err) {
    logger.error({ err, sessionId: req.params?.sessionId, docId: req.params?.docId }, 'Failed to stream document file');
    next(err);
  }
};

export default { getSession, getDoc, getDocFile };
