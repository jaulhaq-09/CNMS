const express = require('express');
const router = express.Router();
const FacultyAchievement = require('../models/FacultyAchievement');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { validateCreateAchievement } = require('../middleware/validation');
const logger = require('../utils/logger');
const AuditService = require('../services/auditService');
const EmailService = require('../services/emailService');
const { notifyApprovers, notifySubmitter, notifyAdminsOfApproval } = require('../services/approvalNotifier');
const {
  canDecide,
  isOwnSubmission,
  visibilityQuery,
  canView,
  resolveScope,
} = require('../utils/approvalRules');

// Fields a request may never set or change directly.
const PROTECTED_FIELDS = [
  '_id',
  '__v',
  'status',
  'submittedBy',
  'approvalHistory',
  'department',
  'createdAt',
  'updatedAt',
  'isAdmin',
];

function withoutProtected(body) {
  const clean = { ...(body || {}) };
  PROTECTED_FIELDS.forEach((field) => delete clean[field]);
  return clean;
}

router.post('/', authenticate, validateCreateAchievement, async (req, res) => {
  try {
    const payload = withoutProtected(req.body);

    // Only a Super Admin may submit for another department; everyone else
    // is tied to the department on their own account.
    if (req.user.role === 'SUPER_ADMIN' && req.body.department) {
      payload.department = req.body.department;
    } else {
      payload.department = req.user.department;
    }

    // Cluster / section must be ones this person is assigned to. With a
    // single cluster it is filled in automatically.
    if (req.user.role !== 'SUPER_ADMIN') {
      const scope = resolveScope(req.user, payload);
      if (scope.error) {
        return res.status(403).json({ success: false, message: scope.error });
      }
      payload.cluster = scope.cluster;
      payload.section = scope.section;
    }

    const achievement = new FacultyAchievement({
      ...payload,
      submittedBy: req.user._id,
      status: 'DRAFT',
    });

    await achievement.save();
    await achievement.populate('department', 'name');
    await achievement.populate('submittedBy', 'firstName lastName email');

    logger.info(`Faculty achievement created: ${achievement._id}`);

    res.status(201).json({
      success: true,
      message: 'Achievement saved as draft',
      data: achievement,
    });
  } catch (error) {
    logger.error('Create faculty achievement error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, department, category, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;
    if (department) query.department = department;
    if (category) query.category = category;

    // Limit the results to what this user is allowed to see.
    const visibility = visibilityQuery(req.user, 'submittedBy');
    const finalQuery = Object.keys(visibility).length > 0 ? { $and: [query, visibility] } : query;

    const achievements = await FacultyAchievement.find(finalQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate('department', 'name')
      .populate('submittedBy', 'firstName lastName');

    const total = await FacultyAchievement.countDocuments(finalQuery);

    res.json({
      success: true,
      data: achievements,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalCount: total,
      },
    });
  } catch (error) {
    logger.error('Get faculty achievements error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const achievement = await FacultyAchievement.findById(req.params.id)
      .populate('department', 'name')
      .populate('submittedBy', 'firstName lastName email')
      .populate('approvalHistory.approver', 'firstName lastName email');

    // Items outside the user's department are reported as "not found",
    // so their existence isn't revealed.
    if (!achievement || !canView(req.user, achievement, 'submittedBy')) {
      return res.status(404).json({ success: false, message: 'Achievement not found' });
    }

    res.json({ success: true, data: achievement });
  } catch (error) {
    logger.error('Get faculty achievement error:', error.message);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const achievement = await FacultyAchievement.findById(req.params.id);
    if (!achievement) {
      return res.status(404).json({ success: false, message: 'Achievement not found' });
    }

    if (
      achievement.submittedBy.toString() !== req.user._id.toString() &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this achievement',
      });
    }

    if (!['DRAFT', 'REJECTED'].includes(achievement.status) && req.user.role !== 'SUPER_ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Only draft or rejected achievements can be edited',
      });
    }

    const changes = withoutProtected(req.body);
    if (
      req.user.role !== 'SUPER_ADMIN' &&
      (changes.cluster !== undefined || changes.section !== undefined)
    ) {
      const scope = resolveScope(req.user, {
        cluster: changes.cluster !== undefined ? changes.cluster : achievement.cluster,
        section: changes.section !== undefined ? changes.section : achievement.section,
      });
      if (scope.error) {
        return res.status(403).json({ success: false, message: scope.error });
      }
      changes.cluster = scope.cluster;
      changes.section = scope.section;
    }
    Object.assign(achievement, changes);
    achievement.updatedAt = new Date();
    await achievement.save();

    res.json({
      success: true,
      message: 'Achievement updated successfully',
      data: achievement,
    });
  } catch (error) {
    logger.error('Update faculty achievement error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const achievement = await FacultyAchievement.findById(req.params.id);
    if (!achievement) {
      return res.status(404).json({ success: false, message: 'Achievement not found' });
    }

    if (
      achievement.submittedBy.toString() !== req.user._id.toString() &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this achievement',
      });
    }

    await FacultyAchievement.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Achievement deleted successfully' });
  } catch (error) {
    logger.error('Delete faculty achievement error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:id/submit', authenticate, async (req, res) => {
  try {
    const achievement = await FacultyAchievement.findById(req.params.id);
    if (!achievement) {
      return res.status(404).json({ success: false, message: 'Achievement not found' });
    }

    if (achievement.submittedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit your own achievements',
      });
    }

    if (!['DRAFT', 'REJECTED'].includes(achievement.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft or rejected achievements can be submitted',
      });
    }

    const wasRejected = achievement.status === 'REJECTED';
    achievement.status = 'SUBMITTED';
    achievement.approvalHistory.push({
      action: wasRejected ? 'RESUBMITTED' : 'SUBMITTED',
      timestamp: new Date(),
    });
    await achievement.save();
    await achievement.populate('department', 'name');

    // Tell this department's approvers (bell + email). This never blocks
    // or fails the submission itself.
    await notifyApprovers({
      itemType: 'achievement',
      itemId: achievement._id,
      title: achievement.title,
      departmentId: achievement.department?._id || achievement.department,
      departmentName: achievement.department?.name,
      cluster: achievement.cluster,
      submitter: req.user,
      io: req.app.get('io'),
      isResubmission: wasRejected,
    });

    res.json({
      success: true,
      message: 'Achievement submitted for approval',
      data: achievement,
    });
  } catch (error) {
    logger.error('Submit faculty achievement error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post(
  '/:id/approve',
  authenticate,
  authorize('COORDINATOR', 'SUPER_ADMIN'),
  async (req, res) => {
    try {
      const { feedback } = req.body;
      const achievement = await FacultyAchievement.findById(req.params.id);
      if (!achievement) {
        return res.status(404).json({ success: false, message: 'Achievement not found' });
      }

      if (!canDecide(req.user, achievement)) {
        return res.status(403).json({
          success: false,
          message: 'You can only approve achievements from your own department and cluster.',
        });
      }

      if (isOwnSubmission(req.user, achievement)) {
        return res.status(403).json({
          success: false,
          message: 'You cannot approve an achievement you submitted yourself. Ask another coordinator or an Admin.',
        });
      }

      if (achievement.status !== 'SUBMITTED') {
        return res.status(400).json({
          success: false,
          message: 'Can only approve submitted achievements',
        });
      }

      achievement.status = 'APPROVED';
      achievement.approvalHistory.push({
        approver: req.user._id,
        action: 'APPROVED',
        feedback,
        timestamp: new Date(),
      });
      await achievement.save();

      await achievement.populate('submittedBy', 'firstName lastName email');
      try {
        await EmailService.sendItemDecisionEmail(achievement.submittedBy, {
          itemLabel: 'achievement',
          title: achievement.title,
          approved: true,
        });
      } catch (emailError) {
        logger.error('Achievement approved email failed:', emailError.message);
      }

      await AuditService.log(
        'ACHIEVEMENT_APPROVED',
        req.user._id,
        'Achievement',
        achievement._id,
        { feedback },
        achievement.title
      );

      await notifySubmitter({
        itemType: 'achievement',
        itemId: achievement._id,
        title: achievement.title,
        decision: 'APPROVED',
        submitterId: achievement.submittedBy?._id,
        decider: req.user,
        io: req.app.get('io'),
      });

      await achievement.populate('department', 'name');
      await notifyAdminsOfApproval({
        itemType: 'achievement',
        itemId: achievement._id,
        title: achievement.title,
        departmentName: achievement.department?.name,
        cluster: achievement.cluster,
        submitterName: `${achievement.submittedBy?.firstName || ''} ${achievement.submittedBy?.lastName || ''}`.trim(),
        approver: req.user,
        io: req.app.get('io'),
      });

      res.json({
        success: true,
        message: 'Achievement approved successfully',
        data: achievement,
      });
    } catch (error) {
      logger.error('Approve faculty achievement error:', error.message);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.post(
  '/:id/reject',
  authenticate,
  authorize('COORDINATOR', 'SUPER_ADMIN'),
  async (req, res) => {
    try {
      const { feedback } = req.body;

      if (!feedback) {
        return res.status(400).json({
          success: false,
          message: 'Feedback is required for rejection',
        });
      }

      const achievement = await FacultyAchievement.findById(req.params.id);
      if (!achievement) {
        return res.status(404).json({ success: false, message: 'Achievement not found' });
      }

      if (!canDecide(req.user, achievement)) {
        return res.status(403).json({
          success: false,
          message: 'You can only reject achievements from your own department and cluster.',
        });
      }

      if (isOwnSubmission(req.user, achievement)) {
        return res.status(403).json({
          success: false,
          message: 'You cannot reject an achievement you submitted yourself. Ask another coordinator or an Admin.',
        });
      }

      if (achievement.status !== 'SUBMITTED') {
        return res.status(400).json({
          success: false,
          message: 'Can only reject submitted achievements',
        });
      }

      achievement.status = 'REJECTED';
      achievement.approvalHistory.push({
        approver: req.user._id,
        action: 'REJECTED',
        feedback,
        timestamp: new Date(),
      });
      await achievement.save();

      await achievement.populate('submittedBy', 'firstName lastName email');
      try {
        await EmailService.sendItemDecisionEmail(achievement.submittedBy, {
          itemLabel: 'achievement',
          title: achievement.title,
          approved: false,
          feedback,
        });
      } catch (emailError) {
        logger.error('Achievement rejected email failed:', emailError.message);
      }

      await AuditService.log(
        'ACHIEVEMENT_REJECTED',
        req.user._id,
        'Achievement',
        achievement._id,
        { feedback },
        achievement.title
      );

      await notifySubmitter({
        itemType: 'achievement',
        itemId: achievement._id,
        title: achievement.title,
        decision: 'REJECTED',
        feedback,
        submitterId: achievement.submittedBy?._id,
        decider: req.user,
        io: req.app.get('io'),
      });

      res.json({
        success: true,
        message: 'Achievement rejected',
        data: achievement,
      });
    } catch (error) {
      logger.error('Reject faculty achievement error:', error.message);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

module.exports = router;