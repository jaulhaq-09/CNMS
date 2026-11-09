const express = require('express');
const router = express.Router();
const ExportService = require('../services/exportService');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const logger = require('../utils/logger');

// File types the backend can genuinely produce. WORD is intentionally
// absent: nothing generates .docx yet, and pretending otherwise hands
// people a corrupt file.
const FORMATS = {
  CSV: { ext: 'csv', mime: 'text/csv' },
  EXCEL: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  PDF: { ext: 'pdf', mime: 'application/pdf' },
};

// URL segment -> ExportService method. `scoped` means the records carry a
// department, so anyone other than Super Admin is limited to their own.
const EXPORTS = {
  events: { method: 'exportEvents', scoped: true },
  newsletters: { method: 'exportNewsletters', scoped: false },
  publications: { method: 'exportPublications', scoped: true },
  patents: { method: 'exportPatents', scoped: true },
  'faculty-achievements': { method: 'exportFacultyAchievements', scoped: true },
  'nptel-courses': { method: 'exportNptelCourses', scoped: true },
};

router.get('/:type', authenticate, authorize('SUPER_ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const config = EXPORTS[req.params.type];
    if (!config) {
      return res.status(404).json({ success: false, message: 'Unknown export type' });
    }

    const format = String(req.query.format || 'CSV').toUpperCase();
    const fileFormat = FORMATS[format];
    if (!fileFormat) {
      return res.status(400).json({
        success: false,
        message: `Unsupported format: ${format}. Use CSV, EXCEL or PDF.`,
      });
    }

    const { status, department, dateFrom, dateTo } = req.query;
    const filters = { status, department, dateFrom, dateTo };

    // Department scoping: only Super Admin may export across departments.
    if (config.scoped && req.user.role !== 'SUPER_ADMIN') {
      const ownDepartment = req.user.department?._id || req.user.department;
      if (!ownDepartment) {
        return res.status(403).json({
          success: false,
          message: 'Your account has no department assigned.',
        });
      }
      filters.department = String(ownDepartment);
    }

    const data = await ExportService[config.method](filters, format);

    res.setHeader('Content-Type', fileFormat.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${req.params.type}_${Date.now()}.${fileFormat.ext}"`
    );
    res.send(data);

    logger.info(`${req.params.type} exported as ${format} by ${req.user.email}`);
  } catch (error) {
    logger.error(`Export ${req.params.type} error:`, error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;