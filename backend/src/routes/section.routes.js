const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/sectionController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const Section = require('../models/Section');
const Cluster = require('../models/Cluster');
const User = require('../models/User');
const Event = require('../models/Event');
const Publication = require('../models/Publication');
const Patent = require('../models/Patent');
const FacultyAchievement = require('../models/FacultyAchievement');
const AuditService = require('../services/auditService');
const logger = require('../utils/logger');

// People and posts store the section as a plain name, so a rename has to be
// copied onto every one of them in the same department and cluster.
const ITEM_MODELS = [Event, Publication, Patent, FacultyAchievement];

// Blocks removing a section while people are still assigned to it.
async function guardDelete(req, res, next) {
  try {
    const section = await Section.findById(req.params.id).select('name cluster');
    if (!section) return next(); // the controller answers "not found"
    const cluster = await Cluster.findById(section.cluster).select('name department');
    if (!cluster) return next();
    const count = await User.countDocuments({
      department: cluster.department,
      clusters: cluster.name,
      sections: section.name,
    });
    if (count > 0) {
      return res.status(409).json({
        success: false,
        message: `${count} ${count === 1 ? 'person is' : 'people are'} still assigned to the section "${section.name}". Move them to another section first.`,
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

router.post('/', authenticate, authorize('SUPER_ADMIN'), sectionController.createSection);

router.get('/', authenticate, sectionController.getSectionsByCluster);

router.put('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const name = String(req.body?.name ?? '').replace(/\s+/g, ' ').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Section name cannot be empty' });
    if (name.length > 100) return res.status(400).json({ success: false, message: 'Section name is too long' });

    const section = await Section.findById(req.params.id);
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });

    const cluster = await Cluster.findById(section.cluster).select('name department');
    if (!cluster) return res.status(404).json({ success: false, message: 'The cluster of this section was not found' });

    const oldName = section.name;
    if (name === oldName) return res.json({ success: true, message: 'Nothing changed', data: section });

    const duplicate = await Section.findOne({
      cluster: section.cluster,
      name,
      _id: { $ne: section._id },
    }).select('_id');
    if (duplicate) {
      return res.status(409).json({ success: false, message: `This cluster already has a section named "${name}"` });
    }

    section.name = name;
    await section.save();

    const updated = { people: 0, posts: 0 };
    try {
      const people = await User.updateMany(
        { department: cluster.department, clusters: cluster.name, sections: oldName },
        { $set: { 'sections.$[s]': name } },
        { arrayFilters: [{ s: oldName }] }
      );
      updated.people = people.modifiedCount || 0;

      for (const Model of ITEM_MODELS) {
        if (!Model.schema.path('section') || !Model.schema.path('cluster') || !Model.schema.path('department')) continue;
        const result = await Model.updateMany(
          { department: cluster.department, cluster: cluster.name, section: oldName },
          { $set: { section: name } }
        );
        updated.posts += result.modifiedCount || 0;
      }
    } catch (cascadeError) {
      logger.error('Section rename cascade failed:', cascadeError.message);
      return res.status(500).json({
        success: false,
        message: 'The section was renamed, but updating the people and posts using it failed. Rename it back and try again.',
      });
    }

    try {
      await AuditService.log(
        'DEPARTMENT_UPDATED',
        req.user._id,
        'Department',
        cluster.department,
        { sectionRenamed: { cluster: cluster.name, from: oldName, to: name }, ...updated },
        `Section ${oldName} → ${name}`
      );
    } catch (auditError) {
      logger.error('Section rename audit failed:', auditError.message);
    }

    return res.json({
      success: true,
      message: `Section renamed. ${updated.people} people and ${updated.posts} posts updated.`,
      data: section,
    });
  } catch (error) {
    logger.error('Rename section error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not rename this section' });
  }
});

router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), guardDelete, sectionController.deleteSection);

module.exports = router;