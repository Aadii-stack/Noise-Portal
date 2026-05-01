import express from 'express';
import multer from 'multer';
import path from 'path';
import { nanoid } from 'nanoid';
import { fileURLToPath } from 'url';
import { getSupabase, getVideosBucket } from '../services/supabase.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const allowedMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/x-msvideo']);
const maxSize = 100 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSize },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Only MP4, MOV, and AVI videos are allowed.'));
    }
    return cb(null, true);
  }
});

router.post('/video', upload.single('video'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Video file is required' });
    }

    const extension = path.extname(req.file.originalname) || '.mp4';
    const fileName = `${Date.now()}-${nanoid(8)}${extension}`;
    const supabase = getSupabase();

    if (supabase) {
      const storagePath = `noise-reports/${fileName}`;
      const { error: uploadError } = await supabase.storage.from(getVideosBucket()).upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(getVideosBucket()).getPublicUrl(storagePath);
      const videoUrl = data.publicUrl;
      return res.status(201).json({ videoUrl, storagePath });
    }

    const localPath = path.join(__dirname, '..', 'uploads', fileName);
    const { writeFile } = await import('fs/promises');
    await writeFile(localPath, req.file.buffer);
    return res.status(201).json({
      videoUrl: `${req.protocol}://${req.get('host')}/uploads/${fileName}`,
      storagePath: `local/uploads/${fileName}`
    });
  } catch (error) {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Video must be 100MB or smaller.' });
    }
    return next(error);
  }
});

export default router;
