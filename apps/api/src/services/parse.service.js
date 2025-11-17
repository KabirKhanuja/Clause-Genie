import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import mammoth from 'mammoth';
import { Queue } from 'bullmq';
import config, { parsedTtlSeconds } from '../config/index.js';

// BullMQ queue 
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
    await simpleParseAndStore(sessionId, meta).catch(e => {
      logger.error({ e }, 'Fallback store failed');
    });
    return false;
  }
}

/**
 * Inline minimal parse / metadata store: store meta in Redis and create an initial preview
 * If `markAsUploaded` is true, store status as 'uploaded' (initial state). Otherwise this
 * function may be used as a fallback to mark as 'parsed' (legacy behaviour)
 */
export async function simpleParseAndStore(sessionId, meta, opts = { markAsUploaded: false }) {
  const client = await connectRedis();
  const metaKey = `session:${sessionId}:doc:${meta.docId}:meta`;

  const status = opts.markAsUploaded ? 'uploaded' : 'parsed';

  // store metadata as string fields for reliable retrieval
  // mark as uploaded / pending parse — worker will flip to "parsed"
  await client.hSet(metaKey, {
    docId: meta.docId,
    originalname: meta.originalname,
    size: String(meta.size || 0),
    mimetype: meta.mimetype || '',
    path: meta.path || '',
    uploadedAt: meta.uploadedAt || new Date().toISOString(),
    status: 'uploaded',      // <-- important: indicates processing is pending
    parsedAt: ''             // still empty until worker completes parsing
  });

  // ensure metadata expires after configured TTL
  if (parsedTtlSeconds && typeof parsedTtlSeconds === 'number') {
    await client.expire(metaKey, parsedTtlSeconds).catch(() => {});
  }

  // attempt a lightweight preview (non-blocking)
  try {
    if (opts.markAsUploaded) {
      // keep preview minimal; worker will replace with real preview when done
      await client.hSet(metaKey, { preview: `${meta.originalname} uploaded — processing` }).catch(() => {});
      if (parsedTtlSeconds) await client.expire(metaKey, parsedTtlSeconds).catch(() => {});
      return true;
    }

    // legacy/fallback behaviour: try to create a small preview from file content
    if (meta.mimetype === 'application/pdf') {
      await client.hSet(metaKey, { preview: 'PDF uploaded (processing)' });
    } else if (meta.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // try to extract a small DOCX preview synchronously (lightweight)
      if (meta.path) {
        try {
          const result = await mammoth.extractRawText({ path: meta.path });
          const text = (result && result.value) ? result.value.trim().slice(0, 300) : 'DOCX uploaded (processing)';
          await client.hSet(metaKey, { preview: text });
        } catch (e) {
          await client.hSet(metaKey, { preview: 'DOCX uploaded (processing)' });
        }
      } else {
        await client.hSet(metaKey, { preview: 'DOCX uploaded (processing)' });
      }
    } else if (meta.mimetype && meta.mimetype.startsWith('image/')) {
      await client.hSet(metaKey, { preview: 'Image uploaded (use OCR later)' });
    } else {
      if (meta.path) {
        const buf = await fs.readFile(meta.path, { encoding: 'utf8' }).catch(() => null);
        if (buf) {
          const snippet = buf.slice(0, 4096);
          await client.hSet(metaKey, { preview: snippet });
          if (parsedTtlSeconds) await client.expire(metaKey, parsedTtlSeconds).catch(() => {});
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to create preview in simpleParseAndStore');
  }

  return true;
}

export default { enqueueDocumentParsing, simpleParseAndStore };
