const express = require('express');
const router = express.Router();
const clusterController = require('../controllers/clusterController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const Cluster = require('../models/Cluster');
const User = require('../models/User');
const Event = require('../models/Event');
const Publication = require('../models/Publication');
const Patent = require('../models/Patent');
const FacultyAchievement = require('../models/FacultyAchievement');
const AuditService = require('../services/auditService');
const logger = require('../utils/logger');

// People and posts store the cluster as a plain name, so a rename has to be
// copied onto every one of them (within the same department).
const ITEM_MODELS = [Event, Publication, Patent, FacultyAchievement];

// Blocks removing a cluster while people are still assigned to it.
async function guardDelete(req, res, next) {
  try {
    const cluster = await Cluster.findById(req.params.id).select('name department');
    if (!cluster) return next(); // the controller answers "not found"
    const count = await User.countDocuments({ department: cluster.department, clusters: cluster.name });
    if (count > 0) {
      return res.status(409).json({
        success: false,
        message: `${count} ${count === 1 ? 'person is' : 'people are'} still assigned to the cluster "${cluster.name}". Move them to another cluster first.`,
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

router.post('/', authenticate, authorize('SUPER_ADMIN'), clusterController.createCluster);

router.get('/', authenticate, clusterController.getClustersByDepartment);

router.put('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const name = String(req.body?.name ?? '').replace(/\s+/g, ' ').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Cluster name cannot be empty' });
    if (name.length > 100) return res.status(400).json({ success: false, message: 'Cluster name is too long' });

    const cluster = await Cluster.findById(req.params.id);
    if (!cluster) return res.status(404).json({ success: false, message: 'Cluster not found' });

    const oldName = cluster.name;
    if (name === oldName) return res.json({ success: true, message: 'Nothing changed', data: cluster });

    const duplicate = await Cluster.findOne({
      department: cluster.department,
      name,
      _id: { $ne: cluster._id },
    }).select('_id');
    if (duplicate) {
      return res.status(409).json({ success: false, message: `This department already has a cluster named "${name}"` });
    }

    cluster.name = name;
    await cluster.save();

    const updated = { people: 0, posts: 0 };
    try {
      const people = await User.updateMany(
        { department: cluster.department, clusters: oldName },
        { $set: { 'clusters.$[c]': name } },
        { arrayFilters: [{ c: oldName }] }
      );
      updated.people = people.modifiedCount || 0;

      for (const Model of ITEM_MODELS) {
        // Skip a model that has no "cluster" field: an unknown field in a
        // filter could otherwise match everything.
        if (!Model.schema.path('cluster') || !Model.schema.path('department')) continue;
        const result = await Model.updateMany(
          { department: cluster.department, cluster: oldName },
          { $set: { cluster: name } }
        );
        updated.posts += result.modifiedCount || 0;
      }
    } catch (cascadeError) {
      logger.error('Cluster rename cascade failed:', cascadeError.message);
      return res.status(500).json({
        success: false,
        message: 'The cluster was renamed, but updating the people and posts using it failed. Rename it back and try again.',
      });
    }

    try {
      await AuditService.log(
        'DEPARTMENT_UPDATED',
        req.user._id,
        'Department',
        cluster.department,
        { clusterRenamed: { from: oldName, to: name }, ...updated },
        `Cluster ${oldName} → ${name}`
      );
    } catch (auditError) {
      logger.error('Cluster rename audit failed:', auditError.message);
    }

    return res.json({
      success: true,
      message: `Cluster renamed. ${updated.people} people and ${updated.posts} posts updated.`,
      data: cluster,
    });
  } catch (error) {
    logger.error('Rename cluster error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not rename this cluster' });
  }
});

router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), guardDelete, clusterController.deleteCluster);

module.exports = router;