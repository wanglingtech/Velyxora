import multer from 'multer';
import fs from 'fs';
import { ENV } from '../config/env';
import { sanitizeFilename } from '../utils/sanitize';

// Ensure temp dir exists
if (!fs.existsSync(ENV.TEMP_DIR)) {
  fs.mkdirSync(ENV.TEMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ENV.TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const cleanName = sanitizeFilename(file.originalname);
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniquePrefix}-${cleanName}`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: ENV.MAX_UPLOAD_SIZE_BYTES,
  },
});
