const departmentService = require('../services/departmentService');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const AuditService = require('../services/auditService');

exports.createDepartment = catchAsync(async (req, res) => {
  const department = await departmentService.createDepartment(req.body);
  logger.info(`Department created: ${department.name} (${department.code})`);
  await AuditService.log(
    'DEPARTMENT_CREATED',
    req.user._id,
    'Department',
    department._id,
    { code: department.code },
    department.name
  );
  res.status(201).json({
    success: true,
    message: 'Department created successfully',
    data: department,
  });
});

exports.getAllDepartments = catchAsync(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const departments = await departmentService.getAllDepartments(includeInactive);
  res.status(200).json({
    success: true,
    data: departments,
  });
});

exports.getDepartmentById = catchAsync(async (req, res) => {
  const department = await departmentService.getDepartmentById(req.params.id);
  res.status(200).json({
    success: true,
    data: department,
  });
});

exports.updateDepartment = catchAsync(async (req, res) => {
  const department = await departmentService.updateDepartment(req.params.id, req.body);
  logger.info(`Department updated: ${department.name}`);
  const reactivated = req.body.isActive === true || req.body.isActive === 'true';
  await AuditService.log(
    reactivated ? 'DEPARTMENT_REACTIVATED' : 'DEPARTMENT_UPDATED',
    req.user._id,
    'Department',
    department._id,
    { fields: Object.keys(req.body || {}) },
    department.name
  );
  res.status(200).json({
    success: true,
    message: 'Department updated successfully',
    data: department,
  });
});

exports.deleteDepartment = catchAsync(async (req, res) => {
  const result = await departmentService.deleteDepartment(req.params.id);
  logger.info(`Department deactivated: ${req.params.id}`);
  const deactivated = await departmentService.getDepartmentById(req.params.id);
  await AuditService.log(
    'DEPARTMENT_DEACTIVATED',
    req.user._id,
    'Department',
    deactivated._id,
    {},
    deactivated.name
  );
  res.status(200).json({
    success: true,
    message: result.message,
  });
});