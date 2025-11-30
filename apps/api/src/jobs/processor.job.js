import { Worker } from 'bullmq';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

if (typeof globalThis.DOMMatrix === 'undefined') {
  try {
    const { DOMMatrix } = require('dommatrix');
    globalThis.DOMMatrix = DOMMatrix;
  } catch {
    globalThis.DOMMatrix = class DOMMatrixShim {
      constructor() {}
      toString() { return 'matrix(1, 0, 0, 1, 0, 0)'; }
    };
  }
}

import mammoth from 'mammoth';
import { connectRedis } from '../utils/redisClient.js';
import config, { parsedTtlSeconds } from '../config/index.js';

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

    if (meta.mimetype === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf')) {
      const data = await fs.readFile(filePath);

      let loaded = null;

      try {
        const cjs = require('pdf-parse');
        loaded = cjs;
      } catch (e) {
        try {
          const mod = await import('pdf-parse');
          loaded = mod;
        } catch (ie) {
          try {
            loaded = require('pdf-parse/node');
          } catch (ne) {
            try {
              const mnode = await import('pdf-parse/node');
              loaded = mnode;
            } catch (nne) {
              logger.warn({ err: [e, ie, ne, nne] }, 'All attempts to load pdf-parse failed');
            }
          }
        }
      }

      if (!loaded) {
        throw new Error('pdf-parse: module failed to load via require() or import()');
      }

      try {
        const keys = (loaded && typeof loaded === 'object') ? Object.keys(loaded) : [];
        if (keys.length === 1 && keys[0] === 'getHeader') {
          try {
            const alt = require('pdf-parse/dist/pdf-parse/cjs/index.cjs');
            if (alt) loaded = alt;
          } catch (errAlt) {
            try {
              const alt2 = await import('pdf-parse/dist/pdf-parse/esm/index.js');
              if (alt2) loaded = alt2;
            } catch (errAlt2) {
              logger.warn({ err: [errAlt, errAlt2], pkgShape: keys }, 'Failed to load explicit pdf-parse dist entry');
            }
          }
        }
      } catch (e) {
      }

      const mod = (loaded && typeof loaded === 'object' && 'default' in loaded) ? loaded.default || loaded : loaded;

      let text = '';

      if (typeof mod === 'function') {
        const pdfRes = await mod(data);
        text = (pdfRes && pdfRes.text) ? pdfRes.text : '';
      } else if (mod && typeof mod.PDFParse === 'function') {
        try {
          const ParserClass = mod.PDFParse;
          const parser = new ParserClass({ data });
          if (typeof parser.getText === 'function') {
            const res = await parser.getText();
            text = (res && res.text) ? res.text : '';
          } else if (typeof parser.getInfo === 'function') {
            const info = await parser.getInfo();
            text = info?.info?.Title ? String(info.info.Title) : '';
          }
        } catch (e) {
          logger.warn({ err: e }, 'Failed to use PDFParse class API');
        }
      } else if (mod && typeof mod.default === 'function') {
        const pdfRes = await mod.default(data);
        text = (pdfRes && pdfRes.text) ? pdfRes.text : '';
      } else {
        const keys = loaded && typeof loaded === 'object' ? Object.keys(loaded) : typeof loaded;
        logger.warn({ pkgShape: keys }, 'pdf-parse module shape unexpected');
        throw new Error('pdf-parse: parser function/class not found on loaded module');
      }

      extractedText = text;
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

    await client.set(textKey, extractedText, { EX: parsedTtlSeconds });

    const preview = (extractedText || '').slice(0, 300);

    await client.hSet(metaKey, {
      parsedAt: new Date().toISOString(),
      status: 'parsed',
      preview,
      path: meta.path || '',
      originalname: meta.originalname || '',
      mimetype: meta.mimetype || '',
      size: meta.size != null ? String(meta.size) : ''
    });

    // applying TTL to metadata hash so it expires with parsed data
    await client.expire(metaKey, parsedTtlSeconds).catch(() => {});

    logger.info({ sessionId, docId: meta.docId }, 'Document parsed and stored in Redis');

    // delete uploaded file only when keepUploads is false
    try {
      if (!config.keepUploads) {
        await fs.unlink(filePath).catch(() => null);
        logger.info({ filePath, sessionId, docId: meta.docId }, 'Uploaded file deleted after parsing');
      } else {
        logger.info({ filePath, sessionId, docId: meta.docId }, 'Keeping uploaded file (keepUploads=true)');
      }
    } catch (e) {
      logger.warn({ err: e, filePath }, 'Failed to delete uploaded file after parsing');
    }

    return;
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