import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import { Queue } from 'bullmq';
import config from '../config/index.js';

// BullMQ queue ( it will requires Redis )
const queue = new Queue('parse-queue', {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined
  }
});

/**
 * Enqueue a document parse job. The worker will:
 * -extract text (PDF/DOCX/OCR)
 * -chunk & embed (later)
 * -store metadata in Redis
 */
export async function enqueueDocumentParsing(sessionId, meta) {
  await queue.add('parse', { sessionId, meta });
  logger.info({ sessionId, doc: meta.docId }, 'Enqueued parse job');
  return true;
}

/**
 * For quick prototypes we can also implement simple inline parsing:
 * (tho not recommended for heavy files - better use job worker)
 */
export async function simpleParseAndStore(sessionId, meta) {
  const client = await connectRedis();
  const key = `session:${sessionId}:doc:${meta.docId}:meta`;
  await client.hSet(key, meta);
  await client.expire(key, 24 * 3600);
  // will optionally produce small preview text
  return true;
}

export default { enqueueDocumentParsing, simpleParseAndStore };