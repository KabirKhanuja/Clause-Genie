import { Worker } from 'bullmq';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';
import { connectRedis } from '../utils/redisClient.js';

// worker connection
const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined
};

const worker = new Worker('parse-queue', async job => {
  const { sessionId, meta } = job.data;
  logger.info({ jobId: job.id, sessionId, docId: meta.docId }, 'Worker processing parse job');

  try {
    const filePath = meta.path;
    let extractedText = '';

    if (!filePath) {
      throw new Error('Missing file path in job meta');
    }

    // we can choose extractor by mimetype / extension
    if (meta.mimetype === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf')) {
      // reading file and parsing it 
      const data = await fs.readFile(filePath);
      const pdfRes = await pdfParse(data);
      extractedText = (pdfRes && pdfRes.text) ? pdfRes.text : '';
    } else if (
      meta.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      filePath.toLowerCase().endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value || '';
    } else if (meta.mimetype && meta.mimetype.startsWith('image/')) {
      // placeholder: we can integrate OCR with integrating tesseract.js here (async)
      extractedText = '[image file — OCR not implemented]';
    } else {
      // try reading as text fallback
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        extractedText = raw;
      } catch (err) {
        extractedText = '';
      }
    }

    // will store results in Redis under session key
    const client = await connectRedis();
    const metaKey = `session:${sessionId}:doc:${meta.docId}:meta`;
    const textKey = `session:${sessionId}:doc:${meta.docId}:text`;

    await client.hSet(metaKey, {
      parsedAt: new Date().toISOString(),
      status: 'parsed'
    });

    // keeping extracted text as a single string 
    await client.set(textKey, extractedText, { EX: 24 * 3600 }); // expired in 24 hours

    logger.info({ sessionId, docId: meta.docId }, 'Document parsed and stored in Redis');
    return Promise.resolve();
  } catch (err) {
    logger.error({ err, sessionId: job.data?.sessionId, docId: job.data?.meta?.docId }, 'Failed to parse document');
    try {
      const client = await connectRedis();
      const metaKey = `session:${sessionId}:doc:${meta.docId}:meta`;
      await client.hSet(metaKey, { status: 'error', error: err.message || 'parse failed' });
    } catch (e) {
    }
    throw err;
  }
}, { connection });

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Parse worker job failed');
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Parse job completed');
});

logger.info('Parse worker started — listening for parse jobs');