// apps/api/src/services/parse.service.js
import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import { Queue } from 'bullmq';
import config from '../config/index.js';

// BullMQ queue (requires Redis)
const queue = new Queue('parse-queue', {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined
  }
});

/**
 * Enqueue a document parse job. If enqueue fails, fallback to simple store.
 */
export async function enqueueDocumentParsing(sessionId, meta) {
  try {
    await queue.add('parse', { sessionId, meta });
    logger.info({ sessionId, doc: meta.docId }, 'Enqueued parse job');
    return true;
  } catch (err) {
    logger.warn({ err }, 'Failed to enqueue parse job, falling back to inline store');
    // fallback: store minimal metadata so the app still works
    await simpleParseAndStore(sessionId, meta).catch(e => {
      logger.error({ e }, 'Fallback store failed');
    });
    return false;
  }
}

/**
 * Inline minimal parse: store meta in Redis and create an initial preview.
 * This was previously present but we need to ensure JSON is stored correctly.
 */
export async function simpleParseAndStore(sessionId, meta) {
  const client = await connectRedis();
  const metaKey = `session:${sessionId}:doc:${meta.docId}:meta`;
  // store metadata as JSON string fields for reliable retrieval
  await client.hSet(metaKey, {
    docId: meta.docId,
    originalname: meta.originalname,
    size: String(meta.size || 0),
    mimetype: meta.mimetype || '',
    path: meta.path || '',
    uploadedAt: meta.uploadedAt || new Date().toISOString()
  });
  await client.expire(metaKey, 24 * 3600);

  // attempt a lightweight preview (first 4KB text) for quick UI
  try {
    if (meta.mimetype === 'application/pdf') {
      // we won't parse heavy here, worker will do full parse. Put placeholder.
      await client.hSet(metaKey, { preview: 'PDF uploaded (processing)' });
    } else if (meta.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      await client.hSet(metaKey, { preview: 'DOCX uploaded (processing)' });
    } else if (meta.mimetype && meta.mimetype.startsWith('image/')) {
      await client.hSet(metaKey, { preview: 'Image uploaded (use OCR later)' });
    } else {
      if (meta.path) {
        const buf = await fs.readFile(meta.path, { encoding: 'utf8' }).catch(() => null);
        if (buf) {
          const snippet = buf.slice(0, 4096);
          await client.hSet(metaKey, { preview: snippet });
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to create preview in simpleParseAndStore');
  }

  return true;
}

export default { enqueueDocumentParsing, simpleParseAndStore };