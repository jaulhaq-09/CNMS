const sectionService = require('../services/sectionService');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

exports.createSection = catchAsync(async (req, res) => {
  const section = await sectionService.createSection(req.body);
  logger.info(`Section created: ${section.name}`);
  res.status(201).json({
    success: true,
    message: 'Section created successfully',
    data: section,
  });
});

exports.getSectionsByCluster = catchAsync(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const sections = await sectionService.getSectionsByCluster(req.query.cluster, includeInactive);
  res.status(200).json({
    success: true,
    data: sections,
  });
});

exports.deleteSection = catchAsync(async (req, res) => {
  const result = await sectionService.deleteSection(req.params.id);
  logger.info(`Section deactivated: ${req.params.id}`);
  res.status(200).json({
    success: true,
    message: result.message,
  });
});