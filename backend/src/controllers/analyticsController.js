const mongoose = require('mongoose');
const analyticsService = require('../services/analyticsService');
const { catchAsync } = require('../middleware/errorHandler');

// Super Admin sees everything. Anyone else is limited to their own department.
// A user with no department gets a filter that matches nothing, never "everything".
function buildScope(user) {
  if (user.role === 'SUPER_ADMIN') return { scope: {}, scopeKey: 'all' };

  const deptId = user.department?._id || user.department;
  if (!deptId) return { scope: { _id: { $in: [] } }, scopeKey: 'none' };

  return {
    scope: { department: new mongoose.Types.ObjectId(String(deptId)) },
    scopeKey: `dept:${deptId}`,
  };
}

exports.getDashboard = catchAsync(async (req, res) => {
  const days = req.query.days || 30;
  const { scope, scopeKey } = buildScope(req.user);
  const data = await analyticsService.getDashboardSummary(days, scope, scopeKey);
  res.status(200).json({ success: true, data });
});

exports.getEventAnalytics = catchAsync(async (req, res) => {
  const days = req.query.days || 30;
  const { scope } = buildScope(req.user);
  const data = await analyticsService.getEventStats(days, scope);
  res.status(200).json({ success: true, data });
});

exports.getNewsletterAnalytics = catchAsync(async (req, res) => {
  const days = req.query.days || 30;
  const { scope } = buildScope(req.user);
  const data = await analyticsService.getNewsletterStats(days, scope);
  res.status(200).json({ success: true, data });
});

exports.getUserAnalytics = catchAsync(async (req, res) => {
  const days = req.query.days || 30;
  const { scope } = buildScope(req.user);
  const data = await analyticsService.getActivityStats(days, scope);
  res.status(200).json({ success: true, data });
});