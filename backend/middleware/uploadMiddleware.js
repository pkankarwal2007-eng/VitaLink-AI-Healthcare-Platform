const multer = require('multer');
const path = require('path');
const fs = require('fs');

const MIME_EXTENSION_MAP = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf']
};

const createStorage = (subfolder) => {
  const uploadPath = path.join(__dirname, '..', 'uploads', subfolder);
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // Safe unique filename: timestamp + random bytes + safe ext
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname || '').toLowerCase();
      const cleanField = (file.fieldname || 'file').replace(/[^a-zA-Z0-9_-]/g, '');
      cb(null, `${cleanField}-${uniqueSuffix}${ext}`);
    }
  });
};

const fileFilter = (allowedMimes) => {
  return (req, file, cb) => {
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type. Allowed formats: ${allowedMimes.join(', ')}`), false);
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    const validExtensions = MIME_EXTENSION_MAP[file.mimetype] || [];

    if (!ext || !validExtensions.includes(ext)) {
      return cb(
        new Error(
          `File extension '${ext}' does not match declared MIME type '${file.mimetype}'. Allowed extensions: ${validExtensions.join(', ')}`
        ),
        false
      );
    }

    cb(null, true);
  };
};

const maxFileSize = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5) * 1024 * 1024;

const avatarUpload = multer({
  storage: createStorage('avatars'),
  limits: { fileSize: maxFileSize },
  fileFilter: fileFilter(['image/jpeg', 'image/png', 'image/webp'])
});

const documentUpload = multer({
  storage: createStorage('documents'),
  limits: { fileSize: maxFileSize },
  fileFilter: fileFilter(['application/pdf', 'image/jpeg', 'image/png'])
});

const reportUpload = multer({
  storage: createStorage('reports'),
  limits: { fileSize: maxFileSize },
  fileFilter: fileFilter(['application/pdf', 'image/jpeg', 'image/png'])
});

module.exports = { avatarUpload, documentUpload, reportUpload };
