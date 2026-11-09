const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { catchAsync } = require('../middleware/errorHandler');
const AppError = require('../utils/AppError');
const importService = require('../services/userImportService');

// Excel upload kept in memory (max 5 MB, .xlsx only). Nothing is written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = /\.xlsx$/i.test(file.originalname || '');
    cb(ok ? null : new AppError('Please upload an .xlsx Excel file.', 400), ok);
  },
});

// Everything here is Admin only.
router.use(authenticate, authorize('SUPER_ADMIN'));

// Download the Excel template
router.get(
  '/template',
  catchAsync(async (req, res) => {
    const buffer = await importService.buildTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="faculty-import-template.xlsx"');
    res.send(Buffer.from(buffer));
  })
);

// Step 1: check the file, nothing is saved
router.post(
  '/preview',
  upload.single('file'),
  catchAsync(async (req, res) => {
    if (!req.file) throw new AppError('No file uploaded.', 400);
    const data = await importService.previewImport(req.file.buffer);
    res.json({ success: true, data });
  })
);

// Step 2: create the accounts and email the credentials (runs in the background)
router.post(
  '/start',
  upload.single('file'),
  catchAsync(async (req, res) => {
    if (!req.file) throw new AppError('No file uploaded.', 400);
    const data = await importService.startImport(req.file.buffer, req.user);
    res.status(202).json({ success: true, data });
  })
);

// Progress of a running or finished import
router.get(
  '/status/:batchId',
  catchAsync(async (req, res) => {
    const job = importService.getJobStatus(req.params.batchId);
    res.json({ success: true, data: job });
  })
);

// Re-issue a temporary password and email it again
router.post(
  '/resend/:userId',
  catchAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      throw new AppError('Invalid user id.', 400);
    }
    const data = await importService.resendCredentials(req.params.userId, req.user);
    res.json({ success: true, message: `Credentials sent to ${data.email}`, data });
  })
);

module.exports = router;