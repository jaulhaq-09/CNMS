const settingsService = require('../services/settingsService');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const AuditService = require('../services/auditService');

exports.getSettings = catchAsync(async (req, res) => {
  const settings = await settingsService.getSettings();
  res.status(200).json({ success: true, data: settings });
});

exports.updateSettings = catchAsync(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body, req.user._id);
  logger.info(`Settings updated: institute name is now "${settings.instituteName}"`);
  // Log which fields changed, not their contents.
  await AuditService.log(
    'SETTINGS_UPDATED',
    req.user._id,
    'Settings',
    settings._id,
    { fields: Object.keys(req.body || {}) },
    'Institute settings'
  );
  res.status(200).json({
    success: true,
    message: 'Settings updated successfully',
    data: settings,
  });
});