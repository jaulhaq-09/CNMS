const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Local disk storage for now — noted as a future upgrade to cloud storage
// (Cloudinary/S3) once this needs to scale beyond a single server.
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'events');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, or WEBP images are allowed'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 30 * 1024 * 1024, files: 5 }, // 30MB per file, max 5 files per request
});

module.exports = upload;