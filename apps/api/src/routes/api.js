import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import config from '../config/index.js';
import uploadController from '../controllers/upload.controller.js';

const router = express.Router();

// i gotta ensure if upload dir exists
const UPLOAD_DIR = path.resolve(config.uploadDir);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer setup (store locally temporarily)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // will keep it original but prefix timestamp
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMB * 1024 * 1024 }
});

// routes
router.get('/health', (req, res) => res.json({ ok: true }));

// this is my upload endpoint: accepts multiple files, returns docIds for session
router.post('/upload', upload.array('files', 8), uploadController.handleUpload);

export default router;