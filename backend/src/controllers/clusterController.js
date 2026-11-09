const clusterService = require('../services/clusterService');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

exports.createCluster = catchAsync(async (req, res) => {
  const cluster = await clusterService.createCluster(req.body);
  logger.info(`Cluster created: ${cluster.name}`);
  res.status(201).json({
    success: true,
    message: 'Cluster created successfully',
    data: cluster,
  });
});

exports.getClustersByDepartment = catchAsync(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const clusters = await clusterService.getClustersByDepartment(req.query.department, includeInactive);
  res.status(200).json({
    success: true,
    data: clusters,
  });
});

exports.deleteCluster = catchAsync(async (req, res) => {
  const result = await clusterService.deleteCluster(req.params.id);
  logger.info(`Cluster deactivated: ${req.params.id}`);
  res.status(200).json({
    success: true,
    message: result.message,
  });
});