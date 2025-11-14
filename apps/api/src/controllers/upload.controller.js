import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import parseService from '../services/parse.service.js';

// POST /upload
const handleUpload = async (req, res, next) => {
  try {
    // expecting sessionId in body (or generate server-side)
    const sessionId = req.body.sessionId || uuidv4();
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // build response metadata
    const uploaded = [];

    for (const file of req.files) {
      const docId = uuidv4();
      const meta = {
        docId,
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: file.path,
        uploadedAt: new Date().toISOString()
      };

      // also optionally: immediate lightweight validation (type/size)
      // persist metadata in Redis immediately so UI can read it right away
      // and still kick off the parse job asynchronously.
      uploaded.push({ docId, meta });

      // store minimal metadata (non-blocking) so front-end can list files
      parseService.simpleParseAndStore(sessionId, meta).catch((err) => {
        logger.warn({ err, sessionId, docId }, 'Failed to store metadata in Redis (simpleParseAndStore)');
      });

      // kick off async parse job (non-blocking)
      parseService.enqueueDocumentParsing(sessionId, meta).catch((err) => {
        logger.error({ err }, 'Failed to enqueue parse job');
      });
    }

    // return sessionId + docs list
    res.json({ sessionId, files: uploaded });
  } catch (err) {
    next(err);
  }
};

export default { handleUpload };