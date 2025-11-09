/**
 * small job worker using BullMQ
 * 
 * this file can be launched in a separate process
 * 
 * it pulls parse jobs and runs heavy parsing and embedding logic
 *
 * run this worker on a diff terminal with
 * "node src/jobs/processor.job.js"
 */
import { Worker } from 'bullmq';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { simpleParseAndStore } from '../services/parse.service.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined
};

const worker = new Worker('parse-queue', async (job) => {
  const { sessionId, meta } = job.data;
  logger.info({ job: job.id, meta }, 'Worker got parse job');

  // need to replace with real parsing pipeline:
  // if PDF => pdfplumber/fitz to extract text
  // if docx => mammoth
  // if image => call OCR
  // chunk => produce embeddings => store in vector DB

  // for prototype, will store meta in redis
  await simpleParseAndStore(sessionId, meta);

  try {
    const ext = path.extname(meta.path).toLowerCase();
    if (['.txt', '.md', '.csv'].includes(ext)) {
      const contents = await fs.readFile(meta.path, 'utf8');
    }
  } catch (err) {
    logger.warn({ err }, 'Preview read failed (likely binary file)');
  }

  return { ok: true };
}, { connection });

worker.on('completed', (job) => logger.info({ jobId: job.id }, 'job completed'));
worker.on('failed', (job, err) => logger.error({ jobId: job.id, err }, 'job failed'));