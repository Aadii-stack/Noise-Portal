import express from 'express';
import path from 'path';
import { nanoid } from 'nanoid';
import { getSupabase, getVideosBucket } from '../services/supabase.js';

const router = express.Router();
const allowedMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/x-msvideo']);
const allowedExtensions = new Set(['.mp4', '.mov', '.avi']);
const maxSize = 100 * 1024 * 1024;
const cacheControl = '3600';

function resolveVideoExtension(fileName, mimeType) {
  const extension = path.extname(path.basename(fileName || '')).toLowerCase();

  if (allowedExtensions.has(extension)) {
    return extension;
  }

  if (mimeType === 'video/quicktime') {
    return '.mov';
  }

  if (mimeType === 'video/x-msvideo') {
    return '.avi';
  }

  return '.mp4';
}

router.post('/video', async (req, res, next) => {
  try {
    const { fileName, mimeType, size } = req.body ?? {};

    if (!fileName || !mimeType) {
      return res.status(400).json({ message: 'Video file metadata is required.' });
    }

    if (!allowedMimeTypes.has(mimeType)) {
      return res.status(400).json({ message: 'Only MP4, MOV, and AVI videos are allowed.' });
    }

    if (typeof size === 'number' && size > maxSize) {
      return res.status(400).json({ message: 'Video must be 100MB or smaller.' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ message: 'Supabase storage must be configured for video uploads.' });
    }

    const storagePath = `noise-reports/${Date.now()}-${nanoid(8)}${resolveVideoExtension(fileName, mimeType)}`;
    const bucket = getVideosBucket();
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath);

    if (error) {
      throw error;
    }

    return res.status(201).json({
      videoUrl: supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl,
      storagePath,
      signedUrl: data.signedUrl,
      token: data.token,
      cacheControl,
      upsert: false
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
