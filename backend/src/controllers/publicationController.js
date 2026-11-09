const Publication = require('../models/Publication');
const logger = require('../utils/logger');
const EmailService = require('../services/emailService');
const AuditService = require('../services/auditService');
const { notifyApprovers, notifySubmitter, notifyAdminsOfApproval } = require('../services/approvalNotifier');
const {
  canDecide,
  isOwnSubmission,
  visibilityQuery,
  canView,
  resolveScope,
} = require('../utils/approvalRules');

// Fields a request may never set or change directly. Everything else about
// a publication is editable while it is still a draft.
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

exports.createPublication = async (req, res) => {
  try {
    const payload = withoutProtected(req.body);
    // A Super Admin may submit for any department; everyone else is tied to
    // the department on their own account (set below).
    if (req.user.role === 'SUPER_ADMIN' && req.body.department) {
      payload.department = req.body.department;
    }

    if (req.user.role !== 'SUPER_ADMIN') {
      payload.department = req.user.department;

      // Cluster / section must be ones this person is assigned to. With a
      // single cluster it is filled in automatically.
      const scope = resolveScope(req.user, payload);
      if (scope.error) {
        return res.status(403).json({ success: false, message: scope.error });
      }
      payload.cluster = scope.cluster;
      payload.section = scope.section;
    }

    const publication = new Publication({
      ...payload,
      submittedBy: req.user._id,
      status: 'DRAFT',
    });

    await publication.save();
    await publication.populate('department', 'name');
    await publication.populate('submittedBy', 'firstName lastName email');

    logger.info(`Publication created: ${publication._id}`);

    res.status(201).json({
      success: true,
      message: 'Publication saved as draft',
      data: publication,
    });
  } catch (error) {
    logger.error('Create publication error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllPublications = async (req, res) => {
  try {
    const { status, department, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;
    if (department) query.department = department;

    // Limit the results to what this user is allowed to see.
    const visibility = visibilityQuery(req.user, 'submittedBy');
    const finalQuery = Object.keys(visibility).length > 0 ? { $and: [query, visibility] } : query;

    const publications = await Publication.find(finalQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate('department', 'name')
      .populate('submittedBy', 'firstName lastName');

    const total = await Publication.countDocuments(finalQuery);

    res.json({
      success: true,
      data: publications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalCount: total,
      },
    });
  } catch (error) {
    logger.error('Get publications error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getPublicationById = async (req, res) => {
  try {
    const publication = await Publication.findById(req.params.id)
      .populate('department', 'name')
      .populate('submittedBy', 'firstName lastName email')
      .populate('approvalHistory.approver', 'firstName lastName email');

    // Items outside the user's department are reported as "not found",
    // so their existence isn't revealed.
    if (!publication || !canView(req.user, publication, 'submittedBy')) {
      return res.status(404).json({ success: false, message: 'Publication not found' });
    }

    res.json({ success: true, data: publication });
  } catch (error) {
    logger.error('Get publication error:', error.message);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updatePublication = async (req, res) => {
  try {
    const publication = await Publication.findById(req.params.id);
    if (!publication) {
      return res.status(404).json({ success: false, message: 'Publication not found' });
    }

    if (
      publication.submittedBy.toString() !== req.user._id.toString() &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this publication',
      });
    }

    // Whether the editor may bypass the draft-only rule is decided from the
    // logged-in user's role, never from anything in the request body.
    if (!['DRAFT', 'REJECTED'].includes(publication.status) && req.user.role !== 'SUPER_ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Only draft or rejected publications can be edited',
      });
    }

    const changes = withoutProtected(req.body);
    if (
      req.user.role !== 'SUPER_ADMIN' &&
      (changes.cluster !== undefined || changes.section !== undefined)
    ) {
      const scope = resolveScope(req.user, {
        cluster: changes.cluster !== undefined ? changes.cluster : publication.cluster,
        section: changes.section !== undefined ? changes.section : publication.section,
      });
      if (scope.error) {
        return res.status(403).json({ success: false, message: scope.error });
      }
      changes.cluster = scope.cluster;
      changes.section = scope.section;
    }
    Object.assign(publication, changes);
    publication.updatedAt = new Date();
    await publication.save();

    res.json({
      success: true,
      message: 'Publication updated successfully',
      data: publication,
    });
  } catch (error) {
    logger.error('Update publication error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deletePublication = async (req, res) => {
  try {
    const publication = await Publication.findById(req.params.id);
    if (!publication) {
      return res.status(404).json({ success: false, message: 'Publication not found' });
    }

    if (
      publication.submittedBy.toString() !== req.user._id.toString() &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this publication',
      });
    }

    await Publication.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Publication deleted successfully' });
  } catch (error) {
    logger.error('Delete publication error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.submitPublication = async (req, res) => {
  try {
    const publication = await Publication.findById(req.params.id);
    if (!publication) {
      return res.status(404).json({ success: false, message: 'Publication not found' });
    }

    if (publication.submittedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit your own publications',
      });
    }

    if (!['DRAFT', 'REJECTED'].includes(publication.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft or rejected publications can be submitted',
      });
    }

    const wasRejected = publication.status === 'REJECTED';
    publication.status = 'SUBMITTED';
    publication.approvalHistory.push({
      action: wasRejected ? 'RESUBMITTED' : 'SUBMITTED',
      timestamp: new Date(),
    });
    await publication.save();
    await publication.populate('department', 'name');

    // Tell this department's approvers (bell + email). This never blocks
    // or fails the submission itself.
    await notifyApprovers({
      itemType: 'publication',
      itemId: publication._id,
      title: publication.title,
      departmentId: publication.department?._id || publication.department,
      departmentName: publication.department?.name,
      cluster: publication.cluster,
      submitter: req.user,
      io: req.app.get('io'),
      isResubmission: wasRejected,
    });

    res.json({
      success: true,
      message: 'Publication submitted for approval',
      data: publication,
    });
  } catch (error) {
    logger.error('Submit publication error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.approvePublication = async (req, res) => {
  try {
    const { feedback } = req.body;
    const publication = await Publication.findById(req.params.id).populate('submittedBy', 'firstName lastName email');
    if (!publication) {
      return res.status(404).json({ success: false, message: 'Publication not found' });
    }

    if (!canDecide(req.user, publication)) {
      return res.status(403).json({
        success: false,
        message: 'You can only approve publications from your own department and cluster.',
      });
    }

    if (isOwnSubmission(req.user, publication)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot approve a publication you submitted yourself. Ask another coordinator or an Admin.',
      });
    }

    if (publication.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        message: 'Can only approve submitted publications',
      });
    }

    publication.status = 'APPROVED';
    publication.approvalHistory.push({
      approver: req.user._id,
      action: 'APPROVED',
      feedback,
      timestamp: new Date(),
    });
    await publication.save();

    try {
      await EmailService.sendPublicationApprovedEmail(publication.submittedBy, publication);
    } catch (emailError) {
      logger.error('Publication approved email failed:', emailError.message);
    }

    await notifySubmitter({
      itemType: 'publication',
      itemId: publication._id,
      title: publication.title,
      decision: 'APPROVED',
      submitterId: publication.submittedBy?._id,
      decider: req.user,
      relatedUrl: `/publications/${publication._id}`,
      io: req.app.get('io'),
    });

    // Tell the Super Admin(s) that something was approved.
    await publication.populate('department', 'name');
    await notifyAdminsOfApproval({
      itemType: 'publication',
      itemId: publication._id,
      title: publication.title,
      departmentName: publication.department?.name,
      cluster: publication.cluster,
      submitterName: `${publication.submittedBy?.firstName || ''} ${publication.submittedBy?.lastName || ''}`.trim(),
      approver: req.user,
      io: req.app.get('io'),
    });

    await AuditService.log('PUBLICATION_APPROVED', req.user._id, 'Publication', publication._id, { feedback }, publication.title);

    res.json({
      success: true,
      message: 'Publication approved successfully',
      data: publication,
    });
  } catch (error) {
    logger.error('Approve publication error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.rejectPublication = async (req, res) => {
  try {
    const { feedback } = req.body;

    if (!feedback) {
      return res.status(400).json({
        success: false,
        message: 'Feedback is required for rejection',
      });
    }

    const publication = await Publication.findById(req.params.id).populate('submittedBy', 'firstName lastName email');
    if (!publication) {
      return res.status(404).json({ success: false, message: 'Publication not found' });
    }

    if (!canDecide(req.user, publication)) {
      return res.status(403).json({
        success: false,
        message: 'You can only reject publications from your own department and cluster.',
      });
    }

    if (isOwnSubmission(req.user, publication)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot reject a publication you submitted yourself. Ask another coordinator or an Admin.',
      });
    }

    if (publication.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        message: 'Can only reject submitted publications',
      });
    }

    publication.status = 'REJECTED';
    publication.approvalHistory.push({
      approver: req.user._id,
      action: 'REJECTED',
      feedback,
      timestamp: new Date(),
    });
    await publication.save();

    try {
      await EmailService.sendPublicationRejectedEmail(publication.submittedBy, publication, feedback);
    } catch (emailError) {
      logger.error('Publication rejected email failed:', emailError.message);
    }

    await notifySubmitter({
      itemType: 'publication',
      itemId: publication._id,
      title: publication.title,
      decision: 'REJECTED',
      feedback,
      submitterId: publication.submittedBy?._id,
      decider: req.user,
      relatedUrl: `/publications/${publication._id}`,
      io: req.app.get('io'),
    });

    await AuditService.log('PUBLICATION_REJECTED', req.user._id, 'Publication', publication._id, { feedback }, publication.title);

    res.json({
      success: true,
      message: 'Publication rejected',
      data: publication,
    });
  } catch (error) {
    logger.error('Reject publication error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};