import { connectRedis } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import mammoth from 'mammoth';
import { Queue } from 'bullmq';
import config, { parsedTtlSeconds } from '../config/index.js';
import { callLLM } from './chat.service.js';

// choose a reasonably small but rich context window for summaries
const SUMMARY_MAX_CHARS = 5000;

function buildSummaryPrompt(snippet) {
  return `Summarize the following document in 3-4 compact yet precise sentences for a lawyer.
Focus on: (1) what the document is, (2) who it applies to, and (3) the most important obligations, rights, or risks.

---
${snippet}`;
}

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
      // For PDFs we expect a separate pipeline to populate :text; here we
      // just set a placeholder preview. Summary will be generated once text exists.
      await client.hSet(metaKey, { preview: 'PDF uploaded (processing)' });
    } else if (meta.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      if (meta.path) {
        try {
          const result = await mammoth.extractRawText({ path: meta.path });
          const text = (result && result.value) ? result.value.trim() : '';
          const trimmed = text.slice(0, SUMMARY_MAX_CHARS);
          const preview = trimmed ? trimmed.slice(0, 300) : 'DOCX uploaded (processing)';
          let summary = '';
          if (trimmed) {
            try {
              const prompt = buildSummaryPrompt(trimmed);
              const { text: llmSummary } = await callLLM(prompt, 'You are Clause-Genie summarizing a legal or policy document for a lawyer.');
              summary = (llmSummary || '').trim();
            } catch (e) {
              const sentences = trimmed.split(/(?<=[\.\!\?])\s+/).slice(0, 2).join(' ');
              summary = sentences || preview;
              logger.warn({ err: e, sessionId, docId: meta.docId }, 'LLM summary failed, falling back to extractive');
            }
          }
          await client.hSet(metaKey, { preview, summary });
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
          const snippet = buf.slice(0, SUMMARY_MAX_CHARS);
          const preview = snippet.slice(0, 300) || `${meta.originalname} uploaded — processing`;
          let summary = '';
          try {
            const prompt = buildSummaryPrompt(snippet);
            const { text: llmSummary } = await callLLM(prompt, 'You are Clause-Genie summarizing a legal or policy document for a lawyer.');
            summary = (llmSummary || '').trim();
          } catch (e) {
            const sentences = snippet.split(/(?<=[\.\!\?])\s+/).slice(0, 2).join(' ');
            summary = sentences || preview;
            logger.warn({ err: e, sessionId, docId: meta.docId }, 'LLM summary failed, falling back to extractive (text)');
          }
          await client.hSet(metaKey, { preview, summary });
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
