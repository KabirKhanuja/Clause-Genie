import { v4 as uuidv4 } from 'uuid';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import parseService from '../services/parse.service.js';
import logger from '../utils/logger.js';
import parseService from '../services/parse.service.js';

// POST /upload
const handleUpload = async (req, res, next) => {
  try {
    // expecting sessionId in body or generate server side
    const sessionId = req.body.sessionId || uuidv4();
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

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

      // it persists the metadata in Redis immediately so ui can read it right away
      // and still kick off the parse job asynchronously
      uploaded.push({ docId, meta });

      // this is storing meta data for the frontend to list all the files 
      parseService.simpleParseAndStore(sessionId, meta).catch((err) => {
        logger.warn({ err, sessionId, docId }, 'Failed to store metadata in Redis (simpleParseAndStore)');
      });

      parseService.enqueueDocumentParsing(sessionId, meta).catch((err) => {
        logger.error({ err }, 'Failed to enqueue parse job');
      });
    }

    // returns sessionId + docs list ie 202 signals async accepted for processing
    res.status(202).json({ sessionId, files: uploaded });
  } catch (err) {
    next(err);
  }
};

export default { handleUpload };