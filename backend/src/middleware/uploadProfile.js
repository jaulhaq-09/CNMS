const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Separate from middleware/upload.js (which is hardcoded to
// uploads/events) since profile photos are a single file per user, not
// a multi-file gallery — different destination, different field name,
// different per-request file limit.
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'profiles');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${req.user._id}-${Date.now()}${ext}`;
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

const uploadProfile = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB, single file
});

// Wrap .single() so upload problems come back as a clear 400 message
// instead of a generic server error. Everything else stays the same, so
// the route file doesn't need to change.
const originalSingle = uploadProfile.single.bind(uploadProfile);

uploadProfile.single = (fieldName) => (req, res, next) => {
  originalSingle(fieldName)(req, res, (err) => {
    if (!err) return next();

    let message = err.message || 'Could not upload the photo.';

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        message = 'Photo must be 5 MB or smaller.';
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        message = 'Please upload a single photo.';
      }
    } else if (err.message !== 'Only JPEG, PNG, or WEBP images are allowed') {
      // Not an upload-validation problem — let the normal error handler deal with it.
      return next(err);
    }

    return res.status(400).json({ success: false, message });
  });
};

module.exports = uploadProfile;