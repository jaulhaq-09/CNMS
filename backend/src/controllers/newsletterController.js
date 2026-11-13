const NewsletterService = require('../services/newsletterService');
const AuditService = require('../services/auditService');
const logger = require('../utils/logger');
const { idOf } = require('../utils/approvalRules');
const mongoose = require('mongoose');

const VALID_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'];

const sameDepartment = (user, newsletter) => {
  const userDept = idOf(user.department);
  const nlDept = idOf(newsletter.department);
  return Boolean(userDept) && Boolean(nlDept) && String(userDept) === String(nlDept);
};

// Only the Admin generates / schedules / publishes / deletes newsletters.
const canManage = (user) => user.role === 'SUPER_ADMIN';

// Who may read one: the Admin (any status). Everyone else only after it is
// published, and only if it is a college-wide issue (no department) or
// belongs to their own department.
const canRead = (user, newsletter) => {
  if (canManage(user)) return true;
  if (newsletter.status !== 'PUBLISHED') return false;
  return !idOf(newsletter.department) || sameDepartment(user, newsletter);
};

const logAudit = async (...args) => {
  try {
    await AuditService.log(...args);
  } catch (err) {
    logger.error('Newsletter audit log failed:', err.message);
  }
};

const errorStatus = (error) => (/not found/i.test(error.message) ? 404 : 400);

// Loads a newsletter and checks the caller may act on it. Returns null after
// sending the response when the caller may not.
const loadForUser = async (req, res, check) => {
  let newsletter;
  try {
    newsletter = await NewsletterService.getNewsletterById(req.params.id);
  } catch (error) {
    res.status(404).json({ success: false, message: 'Newsletter not found' });
    return null;
  }

  if (!check(req.user, newsletter)) {
    // Same answer as "missing" so other departments can't probe for IDs.
    res.status(check === canRead ? 404 : 403).json({
      success: false,
      message: check === canRead ? 'Newsletter not found' : 'Only the Admin can manage newsletters',
    });
    return null;
  }
  return newsletter;
};

exports.generateNewsletter = async (req, res) => {
  try {
    const { startDate, endDate, templateId, departmentId } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required',
      });
    }
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'The start date must be before the end date',
      });
    }

    // Empty means a college-wide issue (the normal monthly one).
    const scopeDepartment = departmentId || null;

    const newsletter = await NewsletterService.generateNewsletter(
      startDate,
      endDate,
      templateId,
      req.user._id,
      scopeDepartment
    );

    await logAudit(
      'NEWSLETTER_GENERATED',
      req.user._id,
      'Newsletter',
      newsletter._id,
      { startDate, endDate, department: scopeDepartment ? String(scopeDepartment) : 'college-wide' },
      newsletter.name
    );

    res.status(201).json({
      success: true,
      message: 'Newsletter generated successfully',
      data: newsletter,
    });
  } catch (error) {
    logger.error('Generate newsletter error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.generateFromConsolidatedReport = async (req, res) => {
  try {
    const { reportId, templateId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ success: false, message: 'A valid consolidated report ID is required' });
    }

    const result = await NewsletterService.generateFromConsolidatedReport(
      reportId,
      templateId,
      req.user._id
    );

    if (!result.alreadyCreated) {
      await logAudit(
        'NEWSLETTER_GENERATED',
        req.user._id,
        'Newsletter',
        result.newsletter._id,
        { sourceReport: String(reportId) },
        result.newsletter.name
      );
    }

    res.status(result.alreadyCreated ? 200 : 201).json({
      success: true,
      message: result.alreadyCreated
        ? 'A newsletter draft already exists for this consolidated report'
        : 'Newsletter draft created from the consolidated report',
      data: result.newsletter,
    });
  } catch (error) {
    logger.error('Generate newsletter from consolidated report error:', error.message);
    res.status(errorStatus(error)).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllNewsletters = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, department } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

    const filters = {};
    if (VALID_STATUSES.includes(status)) filters.status = status;

    const userDept = idOf(req.user.department);

    if (req.user.role === 'SUPER_ADMIN') {
      if (department) filters.department = department;
    } else {
      // Everyone else sees only published issues: college-wide ones
      // plus their own department's.
      filters.status = 'PUBLISHED';
      const visibleTo = [{ department: null }, { department: { $exists: false } }];
      if (userDept) visibleTo.push({ department: userDept });
      filters.$or = visibleTo;
    }

    const result = await NewsletterService.getAllNewsletters(pageNum, limitNum, filters);

    res.json({
      success: true,
      data: result.newsletters,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Get newsletters error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getNewsletterById = async (req, res) => {
  const newsletter = await loadForUser(req, res, canRead);
  if (!newsletter) return;

  res.json({
    success: true,
    data: newsletter,
  });
};

exports.scheduleNewsletter = async (req, res) => {
  try {
    const { scheduledFor } = req.body;

    if (!scheduledFor) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled date/time is required',
      });
    }

    const existing = await loadForUser(req, res, canManage);
    if (!existing) return;

    const newsletter = await NewsletterService.scheduleNewsletter(req.params.id, new Date(scheduledFor));

    await logAudit(
      'NEWSLETTER_SCHEDULED',
      req.user._id,
      'Newsletter',
      newsletter._id,
      { scheduledFor },
      newsletter.name
    );

    res.json({
      success: true,
      message: 'Newsletter scheduled successfully',
      data: newsletter,
    });
  } catch (error) {
    logger.error('Schedule newsletter error:', error.message);
    res.status(errorStatus(error)).json({
      success: false,
      message: error.message,
    });
  }
};

exports.publishNewsletter = async (req, res) => {
  try {
    const existing = await loadForUser(req, res, canManage);
    if (!existing) return;

    const newsletter = await NewsletterService.publishNewsletter(req.params.id, req.user._id);

    await logAudit(
      'NEWSLETTER_PUBLISHED',
      req.user._id,
      'Newsletter',
      newsletter._id,
      { totalSent: newsletter.deliveryStats?.totalSent },
      newsletter.name
    );

    res.json({
      success: true,
      message: 'Newsletter published successfully',
      data: newsletter,
    });
  } catch (error) {
    logger.error('Publish newsletter error:', error.message);
    res.status(errorStatus(error)).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteNewsletter = async (req, res) => {
  try {
    const existing = await loadForUser(req, res, canManage);
    if (!existing) return;

    const result = await NewsletterService.deleteNewsletter(req.params.id);

    await logAudit('NEWSLETTER_DELETED', req.user._id, 'Newsletter', existing._id, {}, existing.name);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    logger.error('Delete newsletter error:', error.message);
    res.status(errorStatus(error)).json({
      success: false,
      message: error.message,
    });
  }
};