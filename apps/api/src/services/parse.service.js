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

export async function simpleParseAndStore(sessionId, meta, opts = { markAsUploaded: false }) {
  const client = await connectRedis();
  const metaKey = `session:${sessionId}:doc:${meta.docId}:meta`;

  const status = opts.markAsUploaded ? 'uploaded' : 'parsed';


  await client.hSet(metaKey, {
    docId: meta.docId,
    originalname: meta.originalname,
    size: String(meta.size || 0),
    mimetype: meta.mimetype || '',
    path: meta.path || '',
    uploadedAt: meta.uploadedAt || new Date().toISOString(),
    status: 'uploaded',      
    parsedAt: ''             
  });

  if (parsedTtlSeconds && typeof parsedTtlSeconds === 'number') {
    await client.expire(metaKey, parsedTtlSeconds).catch(() => {});
  }

  try {
    if (opts.markAsUploaded) {
      await client.hSet(metaKey, { preview: `${meta.originalname} uploaded — processing` }).catch(() => {});
      if (parsedTtlSeconds) await client.expire(metaKey, parsedTtlSeconds).catch(() => {});
      return true;
    }

    if (meta.mimetype === 'application/pdf') {
      await client.hSet(metaKey, { preview: 'PDF uploaded (processing)' });
    } else if (meta.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
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
