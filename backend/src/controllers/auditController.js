const mongoose = require('mongoose');
const auditService = require('../services/auditService');
const { catchAsync } = require('../middleware/errorHandler');

// People who appear in the log, for the "Performed by" filter.
exports.getAuditActors = catchAsync(async (req, res) => {
  const actors = await auditService.getActors();
  res.status(200).json({ success: true, data: actors });
});

exports.getAuditLogs = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, action, targetType, actor, from, to } = req.query;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  // Up to 1000 per request so the page can build an Excel/CSV export.
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 1000);

  const result = await auditService.getPaginatedLogs(pageNum, limitNum, {
    action,
    targetType,
    actor: actor && mongoose.isValidObjectId(actor) ? actor : undefined,
    from,
    to,
  });

  res.status(200).json({
    success: true,
    data: result.logs,
    pagination: result.pagination,
  });
});