const express = require('express');
const router = express.Router();
const Patent = require('../models/Patent');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { validateCreatePatent } = require('../middleware/validation');
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
router.post('/', authenticate, validateCreatePatent, async (req, res) => {
  try {
    const payload = withoutProtected(req.body);
    
    // Only a Super Admin may submit for another department; everyone else
    // is tied to the department on their own account.
    if (req.user.role === 'SUPER_ADMIN' && req.body.department) {
      payload.department = req.body.department;
    } else {
      payload.department = req.user.department;
    }
    if (!payload.department) {
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

    const patent = new Patent({
      ...payload,
      submittedBy: req.user._id,
      status: 'DRAFT',
    });

    await patent.save();
    await patent.populate('department', 'name');
    await patent.populate('submittedBy', 'firstName lastName email');

    logger.info(`Patent created: ${patent._id}`);

    res.status(201).json({
      success: true,
      message: 'Patent saved as draft',
      data: patent,
    });
  } catch (error) {
    logger.error('Create patent error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, department, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;
    if (department) query.department = department;

    // Limit the results to what this user is allowed to see.
    const visibility = visibilityQuery(req.user, 'submittedBy');
    const finalQuery = Object.keys(visibility).length > 0 ? { $and: [query, visibility] } : query;

    const patents = await Patent.find(finalQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate('department', 'name')
      .populate('submittedBy', 'firstName lastName');

    const total = await Patent.countDocuments(finalQuery);

    res.json({
      success: true,
      data: patents,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalCount: total,
      },
    });
  } catch (error) {
    logger.error('Get patents error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const patent = await Patent.findById(req.params.id)
      .populate('department', 'name')
      .populate('submittedBy', 'firstName lastName email')
      .populate('approvalHistory.approver', 'firstName lastName email');

    // Items outside the user's department are reported as "not found",
    // so their existence isn't revealed.
    if (!patent || !canView(req.user, patent, 'submittedBy')) {
      return res.status(404).json({ success: false, message: 'Patent not found' });
    }

    res.json({ success: true, data: patent });
  } catch (error) {
    logger.error('Get patent error:', error.message);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const patent = await Patent.findById(req.params.id);
    if (!patent) {
      return res.status(404).json({ success: false, message: 'Patent not found' });
    }

    if (
      patent.submittedBy.toString() !== req.user._id.toString() &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this patent',
      });
    }

    if (!['DRAFT', 'REJECTED'].includes(patent.status) && req.user.role !== 'SUPER_ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Only draft or rejected patents can be edited',
      });
    }

    const changes = withoutProtected(req.body);
    if (
      req.user.role !== 'SUPER_ADMIN' &&
      (changes.cluster !== undefined || changes.section !== undefined)
    ) {
      const scope = resolveScope(req.user, {
        cluster: changes.cluster !== undefined ? changes.cluster : patent.cluster,
        section: changes.section !== undefined ? changes.section : patent.section,
      });
      if (scope.error) {
        return res.status(403).json({ success: false, message: scope.error });
      }
      changes.cluster = scope.cluster;
      changes.section = scope.section;
    }
    Object.assign(patent, changes);
    patent.updatedAt = new Date();
    await patent.save();

    res.json({
      success: true,
      message: 'Patent updated successfully',
      data: patent,
    });
  } catch (error) {
    logger.error('Update patent error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const patent = await Patent.findById(req.params.id);
    if (!patent) {
      return res.status(404).json({ success: false, message: 'Patent not found' });
    }

    if (
      patent.submittedBy.toString() !== req.user._id.toString() &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this patent',
      });
    }

    await Patent.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Patent deleted successfully' });
  } catch (error) {
    logger.error('Delete patent error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:id/submit', authenticate, async (req, res) => {
  try {
    const patent = await Patent.findById(req.params.id);
    if (!patent) {
      return res.status(404).json({ success: false, message: 'Patent not found' });
    }

    if (patent.submittedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit your own patents',
      });
    }

    if (!['DRAFT', 'REJECTED'].includes(patent.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft or rejected patents can be submitted',
      });
    }

    const wasRejected = patent.status === 'REJECTED';
    patent.status = 'SUBMITTED';
    patent.approvalHistory.push({
      action: wasRejected ? 'RESUBMITTED' : 'SUBMITTED',
      timestamp: new Date(),
    });
    await patent.save();
    await patent.populate('department', 'name');

    // Tell this department's approvers (bell + email). This never blocks
    // or fails the submission itself.
    await notifyApprovers({
      itemType: 'patent',
      itemId: patent._id,
      title: patent.title,
      departmentId: patent.department?._id || patent.department,
      departmentName: patent.department?.name,
      cluster: patent.cluster,
      submitter: req.user,
      io: req.app.get('io'),
      isResubmission: wasRejected,
    });

    res.json({
      success: true,
      message: 'Patent submitted for approval',
      data: patent,
    });
  } catch (error) {
    logger.error('Submit patent error:', error.message);
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
      const patent = await Patent.findById(req.params.id);
      if (!patent) {
        return res.status(404).json({ success: false, message: 'Patent not found' });
      }

      if (!canDecide(req.user, patent)) {
        return res.status(403).json({
          success: false,
          message: 'You can only approve patents from your own department and cluster.',
        });
      }

      if (isOwnSubmission(req.user, patent)) {
        return res.status(403).json({
          success: false,
          message: 'You cannot approve a patent you submitted yourself. Ask another coordinator or an Admin.',
        });
      }

      if (patent.status !== 'SUBMITTED') {
        return res.status(400).json({
          success: false,
          message: 'Can only approve submitted patents',
        });
      }

      patent.status = 'APPROVED';
      patent.approvalHistory.push({
        approver: req.user._id,
        action: 'APPROVED',
        feedback,
        timestamp: new Date(),
      });
      await patent.save();

      await patent.populate('submittedBy', 'firstName lastName email');
      try {
        await EmailService.sendItemDecisionEmail(patent.submittedBy, {
          itemLabel: 'patent',
          title: patent.title,
          approved: true,
        });
      } catch (emailError) {
        logger.error('Patent approved email failed:', emailError.message);
      }

      await AuditService.log('PATENT_APPROVED', req.user._id, 'Patent', patent._id, { feedback }, patent.title);

      await notifySubmitter({
        itemType: 'patent',
        itemId: patent._id,
        title: patent.title,
        decision: 'APPROVED',
        submitterId: patent.submittedBy?._id,
        decider: req.user,
        io: req.app.get('io'),
      });

      await patent.populate('department', 'name');
      await notifyAdminsOfApproval({
        itemType: 'patent',
        itemId: patent._id,
        title: patent.title,
        departmentName: patent.department?.name,
        cluster: patent.cluster,
        submitterName: `${patent.submittedBy?.firstName || ''} ${patent.submittedBy?.lastName || ''}`.trim(),
        approver: req.user,
        io: req.app.get('io'),
      });

      res.json({
        success: true,
        message: 'Patent approved successfully',
        data: patent,
      });
    } catch (error) {
      logger.error('Approve patent error:', error.message);
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

      const patent = await Patent.findById(req.params.id);
      if (!patent) {
        return res.status(404).json({ success: false, message: 'Patent not found' });
      }

      if (!canDecide(req.user, patent)) {
        return res.status(403).json({
          success: false,
          message: 'You can only reject patents from your own department and cluster.',
        });
      }

      if (isOwnSubmission(req.user, patent)) {
        return res.status(403).json({
          success: false,
          message: 'You cannot reject a patent you submitted yourself. Ask another coordinator or an Admin.',
        });
      }

      if (patent.status !== 'SUBMITTED') {
        return res.status(400).json({
          success: false,
          message: 'Can only reject submitted patents',
        });
      }

      patent.status = 'REJECTED';
      patent.approvalHistory.push({
        approver: req.user._id,
        action: 'REJECTED',
        feedback,
        timestamp: new Date(),
      });
      await patent.save();

      await patent.populate('submittedBy', 'firstName lastName email');
      try {
        await EmailService.sendItemDecisionEmail(patent.submittedBy, {
          itemLabel: 'patent',
          title: patent.title,
          approved: false,
          feedback,
        });
      } catch (emailError) {
        logger.error('Patent rejected email failed:', emailError.message);
      }

      await AuditService.log('PATENT_REJECTED', req.user._id, 'Patent', patent._id, { feedback }, patent.title);

      await notifySubmitter({
        itemType: 'patent',
        itemId: patent._id,
        title: patent.title,
        decision: 'REJECTED',
        feedback,
        submitterId: patent.submittedBy?._id,
        decider: req.user,
        io: req.app.get('io'),
      });

      res.json({
        success: true,
        message: 'Patent rejected',
        data: patent,
      });
    } catch (error) {
      logger.error('Reject patent error:', error.message);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

module.exports = router;