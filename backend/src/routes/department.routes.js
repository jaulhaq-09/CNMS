const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { validateCreateDepartment, validateMongoId } = require('../middleware/validation');
const mongoose = require('mongoose');
const Department = require('../models/Department');
const Cluster = require('../models/Cluster');
const Section = require('../models/Section');
const AuditService = require('../services/auditService');
const logger = require('../utils/logger');

// Counts every record in any model that still points at this department.
async function findUsage(departmentId) {
  const skip = new Set(['Department', 'Cluster', 'Section']);
  const usage = [];

  for (const modelName of mongoose.modelNames()) {
    if (skip.has(modelName)) continue;
    const model = mongoose.model(modelName);
    const fields = [];

    model.schema.eachPath((pathName, schemaType) => {
      const single = schemaType.options && schemaType.options.ref === 'Department';
      const inArray =
        schemaType.caster && schemaType.caster.options && schemaType.caster.options.ref === 'Department';
      if (single || inArray) fields.push(pathName);
    });

    for (const field of fields) {
      try {
        const count = await model.countDocuments({ [field]: departmentId });
        if (count > 0) usage.push({ model: modelName, field, count });
      } catch (err) {
        logger.warn(`Department usage check skipped ${modelName}.${field}: ${err.message}`);
      }
    }
  }
  return usage;
}

router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN'),
  ...validateCreateDepartment,
  departmentController.createDepartment
);

router.get('/', authenticate, departmentController.getAllDepartments);

router.get('/:id', authenticate, validateMongoId, departmentController.getDepartmentById);

router.put(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  validateMongoId,
  departmentController.updateDepartment
);

router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  validateMongoId,
  departmentController.deleteDepartment
);

// Permanent delete: removes the department with its clusters and sections.
// Refused while people or posts still belong to it.
router.delete(
  '/:id/permanent',
  authenticate,
  authorize('SUPER_ADMIN'),
  validateMongoId,
  async (req, res) => {
    try {
      const department = await Department.findById(req.params.id);
      if (!department) {
        return res.status(404).json({ success: false, message: 'Department not found' });
      }

      const usage = await findUsage(department._id);
      if (usage.length > 0) {
        const summary = usage.map((u) => `${u.count} ${u.model}`).join(', ');
        return res.status(409).json({
          success: false,
          message: `Cannot delete "${department.name}" - still used by ${summary}. Move or merge them first, or use Deactivate instead.`,
          usage,
        });
      }

      const clusters = await Cluster.find({ department: department._id }).select('_id');
      const clusterIds = clusters.map((c) => c._id);
      const sectionResult = clusterIds.length
        ? await Section.deleteMany({ cluster: { $in: clusterIds } })
        : { deletedCount: 0 };
      const clusterResult = await Cluster.deleteMany({ department: department._id });
      await Department.deleteOne({ _id: department._id });

      // The audit enum has no DEPARTMENT_DELETED, so this reuses DEPARTMENT_DEACTIVATED.
      await AuditService.log(
        'DEPARTMENT_DEACTIVATED',
        req.user._id,
        'Department',
        department._id,
        { permanentlyDeleted: true, clusters: clusterResult.deletedCount, sections: sectionResult.deletedCount },
        `Deleted department ${department.name}`
      );

      res.json({ success: true, message: `Department "${department.name}" deleted` });
    } catch (err) {
      logger.error('Permanent department delete failed:', err);
      res.status(500).json({ success: false, message: 'Failed to delete department' });
    }
  }
);

module.exports = router;