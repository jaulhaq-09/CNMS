const express = require('express');
const router = express.Router();
const ReportService = require('../services/reportService');
const EmailService = require('../services/emailService');
const Event = require('../models/Event');
const Publication = require('../models/Publication');
const Patent = require('../models/Patent');
const FacultyAchievement = require('../models/FacultyAchievement');
const NptelCourse = require('../models/NptelCourse');
const Report = require('../models/Report');
const User = require('../models/User');
const authorize = require('../middleware/authorize');

const FORMAT_META = {
  PDF: { ext: 'pdf', mime: 'application/pdf' },
  EXCEL: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  CSV: { ext: 'csv', mime: 'text/csv' },
};
const authenticate = require('../middleware/authenticate');
const logger = require('../utils/logger');
const { validateCreateReport } = require('../middleware/validation');


const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 20;

// Checks a schedule request and returns a cleaned copy, so a bad value can
// never be stored (a missing dayOfMonth, for instance, silently stops a
// monthly report from ever running).
function validateSchedule(body = {}) {
  const { frequency, time } = body;

  if (!FREQUENCIES.includes(frequency)) {
    return { error: 'Choose a valid frequency.' };
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''))) {
    return { error: 'Time must be in HH:MM format.' };
  }

  let dayOfWeek;
  let dayOfMonth;

  if (frequency === 'WEEKLY') {
    dayOfWeek = Number(body.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return { error: 'Choose a day of the week.' };
    }
  }

  if (['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(frequency)) {
    dayOfMonth = Number(body.dayOfMonth);
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      return { error: 'Choose a day of the month between 1 and 28.' };
    }
  }

  const recipients = [
    ...new Set(
      (Array.isArray(body.recipients) ? body.recipients : []).map((e) => String(e).trim().toLowerCase())
    ),
  ];
  if (recipients.length === 0) return { error: 'Add at least one recipient.' };
  if (recipients.length > MAX_RECIPIENTS) {
    return { error: `You can add up to ${MAX_RECIPIENTS} recipients.` };
  }
  if (recipients.some((e) => !EMAIL_RE.test(e))) {
    return { error: 'One or more recipient emails are not valid.' };
  }

  return { value: { frequency, time, dayOfWeek, dayOfMonth, recipients } };
}

// Create report
router.post('/', authenticate, ...validateCreateReport, async (req, res) => {
  try {
    const { name, description, type, filters, columns, metrics, format, settings } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: 'Name and type are required',
      });
    }

    const report = await ReportService.createReport(
      {
        name,
        description,
        type,
        filters,
        columns,
        metrics,
        format: format || 'PDF',
        settings,
      },
      req.user._id
    );

    res.status(201).json({
      success: true,
      message: 'Report created successfully',
      data: report,
    });
  } catch (error) {
    logger.error('Create report error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Get all reports
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const result = await ReportService.getAllReports(req.user._id, parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result.reports,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Get reports error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get report
router.get('/:id', authenticate, async (req, res) => {
  try {
    const report = await ReportService.getReportById(req.params.id);

    if (report.owner._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Get report error:', error.message);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

// Update report
router.put('/:id', authenticate, async (req, res) => {
  try {
    const report = await ReportService.updateReport(req.params.id, req.body, req.user._id);

    res.json({
      success: true,
      message: 'Report updated successfully',
      data: report,
    });
  } catch (error) {
    logger.error('Update report error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Delete report
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await ReportService.deleteReport(req.params.id, req.user._id);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    logger.error('Delete report error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Generate report
router.post('/:id/generate', authenticate, async (req, res) => {
  try {
    const report = await ReportService.getReportById(req.params.id);

    if (report.owner._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const data = await ReportService.generateReportData(report);

    if (report.format === 'EXCEL') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else if (report.format === 'PDF') {
      res.setHeader('Content-Type', 'application/pdf');
    } else {
      res.setHeader('Content-Type', 'text/csv');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${report.lastGenerated.fileName}"`);
    res.send(data);

    logger.info(`Report generated: ${report._id}`);
  } catch (error) {
    logger.error('Generate report error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Schedule report
router.post('/:id/schedule', authenticate, async (req, res) => {
  try {
    const { error: scheduleError, value: scheduleValue } = validateSchedule(req.body);
    if (scheduleError) {
      return res.status(400).json({ success: false, message: scheduleError });
    }
    const { frequency, dayOfWeek, dayOfMonth, time, recipients } = scheduleValue;

    const report = await ReportService.getReportById(req.params.id);

    if (report.owner._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    report.scheduling = {
      enabled: true,
      frequency,
      dayOfWeek,
      dayOfMonth,
      time,
      recipients: recipients || [],
    };

    await report.save();

    res.json({
      success: true,
      message: 'Report scheduled successfully',
      data: report,
    });
  } catch (error) {
    logger.error('Schedule report error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Email a one-off copy of the report to the person asking (never anyone else),
// so delivery can be tested without waiting for the schedule.
router.post('/:id/email-me', authenticate, async (req, res) => {
  try {
    const report = await ReportService.getReportById(req.params.id);

    if (report.owner._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const data = await ReportService.generateReportData(report, { record: false });

    const meta = FORMAT_META[report.format] || FORMAT_META.PDF;
    const result = await EmailService.sendReportEmail([req.user.email], report, {
      data,
      filename: `${report.name}.${meta.ext}`,
      mime: meta.mime,
    });

    if (result.delivered === 0) {
      return res.status(502).json({
        success: false,
        message: 'The email could not be sent. Check the email settings on the server.',
      });
    }

    res.json({ success: true, message: `Test report sent to ${req.user.email}` });
  } catch (error) {
    logger.error('Email report error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});
// Unschedule report
router.post('/:id/unschedule', authenticate, async (req, res) => {
  try {
    const report = await ReportService.unscheduleReport(req.params.id, req.user._id);

    res.json({
      success: true,
      message: 'Report unscheduled successfully',
      data: report,
    });
  } catch (error) {
    logger.error('Unschedule report error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// --- Coordinator: Get all approved activities to curate into a cluster report ---
router.get('/coordinator/approved-activities', authenticate, authorize('COORDINATOR', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const { dateFrom, dateTo, cluster, department } = req.query;

    const query = { status: 'APPROVED' };
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const deptId = department || (req.user.role !== 'SUPER_ADMIN' ? (req.user.department?._id || req.user.department) : null);
    if (deptId) {
      query.department = deptId;
    }

    const userClusters = req.user.clusters || [];
    const targetCluster = cluster || (userClusters.length === 1 ? userClusters[0] : null);

    const [events, publications, patents, achievements, nptel] = await Promise.all([
      Event.find(query).populate('createdBy', 'firstName lastName email').populate('department', 'name code').sort({ date: -1, createdAt: -1 }),
      Publication.find(query).populate('submittedBy', 'firstName lastName email').populate('department', 'name code').sort({ createdAt: -1 }),
      Patent.find(query).populate('submittedBy', 'firstName lastName email').populate('department', 'name code').sort({ createdAt: -1 }),
      FacultyAchievement.find(query).populate('submittedBy', 'firstName lastName email').populate('department', 'name code').sort({ date: -1, createdAt: -1 }),
      NptelCourse.find(query).populate('faculty', 'firstName lastName email').populate('department', 'name code').sort({ createdAt: -1 }),
    ]);

    const formatted = [];

    events.forEach((ev) => {
      formatted.push({
        id: ev._id.toString(),
        sourceModel: 'Event',
        type: 'EVENT',
        category: ev.category || 'Event',
        title: ev.eventName,
        description: ev.description || '',
        date: ev.eventDate || ev.createdAt,
        facultyName: ev.createdBy ? `${ev.createdBy.firstName} ${ev.createdBy.lastName}` : 'Faculty',
        facultyEmail: ev.createdBy?.email || '',
        department: ev.department?.name || '',
        cluster: ev.cluster || targetCluster || '',
        photos: ev.photos || [],
        certificateUrl: null,
        included: true,
        coordinatorRemarks: '',
      });
    });

    publications.forEach((pub) => {
      formatted.push({
        id: pub._id.toString(),
        sourceModel: 'Publication',
        type: 'PUBLICATION',
        category: 'Publication',
        title: pub.title,
        description: `${pub.journalOrConference || ''} (${pub.indexing || ''}) - DOI: ${pub.doi || 'N/A'}`.trim(),
        date: pub.publicationDate || pub.createdAt,
        facultyName: pub.submittedBy ? `${pub.submittedBy.firstName} ${pub.submittedBy.lastName}` : (pub.authors?.[0]?.name || 'Faculty'),
        facultyEmail: pub.submittedBy?.email || '',
        department: pub.department?.name || '',
        cluster: targetCluster || '',
        photos: [],
        certificateUrl: pub.paperUrl || null,
        included: true,
        coordinatorRemarks: '',
      });
    });

    patents.forEach((pat) => {
      formatted.push({
        id: pat._id.toString(),
        sourceModel: 'Patent',
        type: 'PATENT',
        category: 'Patent',
        title: pat.title,
        description: `App #${pat.applicationNumber || ''} - Status: ${pat.patentStatus || 'Filed'}`,
        date: pat.filingDate || pat.createdAt,
        facultyName: pat.submittedBy ? `${pat.submittedBy.firstName} ${pat.submittedBy.lastName}` : 'Faculty',
        facultyEmail: pat.submittedBy?.email || '',
        department: pat.department?.name || '',
        cluster: targetCluster || '',
        photos: [],
        certificateUrl: null,
        included: true,
        coordinatorRemarks: '',
      });
    });

    achievements.forEach((ach) => {
      formatted.push({
        id: ach._id.toString(),
        sourceModel: 'FacultyAchievement',
        type: 'ACHIEVEMENT',
        category: ach.category || 'Achievement',
        title: ach.title,
        description: ach.description || '',
        date: ach.date || ach.createdAt,
        facultyName: ach.submittedBy ? `${ach.submittedBy.firstName} ${ach.submittedBy.lastName}` : 'Faculty',
        facultyEmail: ach.submittedBy?.email || '',
        department: ach.department?.name || '',
        cluster: targetCluster || '',
        photos: ach.photos || [],
        certificateUrl: ach.certificateUrl || null,
        included: true,
        coordinatorRemarks: '',
      });
    });

    nptel.forEach((n) => {
      formatted.push({
        id: n._id.toString(),
        sourceModel: 'NptelCourse',
        type: 'NPTEL',
        category: 'Certification',
        title: `${n.platform || 'NPTEL'}: ${n.courseName}`,
        description: `Score: ${n.score ?? 'N/A'}% | Type: ${n.certificateType || 'Completed'}`,
        date: n.createdAt,
        facultyName: n.faculty ? `${n.faculty.firstName} ${n.faculty.lastName}` : 'Faculty',
        facultyEmail: n.faculty?.email || '',
        department: n.department?.name || '',
        cluster: targetCluster || '',
        photos: [],
        certificateUrl: n.certificateUrl || null,
        included: true,
        coordinatorRemarks: '',
      });
    });

    res.json({
      success: true,
      data: formatted,
      total: formatted.length,
    });
  } catch (error) {
    logger.error('Get approved activities error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Coordinator: Forward Curated Cluster Report to Admin ---
router.post('/coordinator/forward', authenticate, authorize('COORDINATOR', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, cluster, department, curatedItems, coordinatorComments } = req.body;

    const items = Array.isArray(curatedItems) ? curatedItems : [];
    const includedItems = items.filter((it) => it.included !== false);

    const reportName =
      name ||
      `Cluster Report - ${cluster || req.user.clusters?.[0] || 'Default'} (${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`;

    const report = new Report({
      name: reportName,
      type: 'CLUSTER_REPORT',
      status: 'SUBMITTED_TO_ADMIN',
      cluster: cluster || req.user.clusters?.[0] || '',
      department: department || req.user.department?._id || req.user.department || undefined,
      forwardedBy: req.user._id,
      forwardedAt: new Date(),
      coordinatorComments: coordinatorComments || '',
      curatedItems: includedItems,
      summary: {
        totalApproved: items.length,
        totalIncluded: includedItems.length,
      },
      owner: req.user._id,
    });

    await report.save();
    await report.populate('forwardedBy', 'firstName lastName email');
    await report.populate('department', 'name code');

    logger.info(`Cluster report forwarded to Admin by ${req.user.email} (Report ID: ${report._id})`);

    res.status(201).json({
      success: true,
      message: 'Report forwarded to Admin successfully',
      data: report,
    });
  } catch (error) {
    logger.error('Forward cluster report error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// --- Admin: Get all Coordinator Forwarded Reports ---
router.get('/admin/coordinator-reports', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const reports = await Report.find({ type: 'CLUSTER_REPORT' })
      .populate('forwardedBy', 'firstName lastName email')
      .populate('department', 'name code')
      .populate('consolidatedReportId', 'name summary')
      .sort({ forwardedAt: -1, createdAt: -1 });

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    logger.error('Get coordinator reports error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Admin: Consolidate multiple coordinator reports into a final institutional report ---
router.post('/admin/consolidate', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, description, reportIds, adminNotes } = req.body;

    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one coordinator report to consolidate.' });
    }

    const sourceReports = await Report.find({ _id: { $in: reportIds } })
      .populate('forwardedBy', 'firstName lastName email')
      .populate('department', 'name code');

    if (sourceReports.length === 0) {
      return res.status(404).json({ success: false, message: 'No matching coordinator reports found.' });
    }

    // Merge curated items
    const mergedItems = [];
    sourceReports.forEach((sr) => {
      const items = Array.isArray(sr.curatedItems) ? sr.curatedItems : [];
      items.forEach((item) => {
        mergedItems.push({
          ...item,
          sourceReportId: sr._id,
          clusterName: sr.cluster || 'General',
          departmentName: sr.department?.name || '',
          coordinatorName: sr.forwardedBy ? `${sr.forwardedBy.firstName} ${sr.forwardedBy.lastName}` : '',
        });
      });
    });

    const masterReport = new Report({
      name: name || `Institutional Newsletter Report - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      description: description || `Consolidated from ${sourceReports.length} coordinator reports. ${adminNotes || ''}`.trim(),
      type: 'INSTITUTIONAL_REPORT',
      status: 'CONSOLIDATED',
      owner: req.user._id,
      sourceReportIds: reportIds,
      curatedItems: mergedItems,
      summary: {
        totalCoordinators: sourceReports.length,
        totalItems: mergedItems.length,
        consolidatedAt: new Date(),
      },
    });

    await masterReport.save();

    // Mark sources as CONSOLIDATED
    await Report.updateMany(
      { _id: { $in: reportIds } },
      { $set: { status: 'CONSOLIDATED', consolidatedReportId: masterReport._id } }
    );

    logger.info(`Admin ${req.user.email} consolidated ${sourceReports.length} reports into Master Report ${masterReport._id}`);

    res.status(201).json({
      success: true,
      message: 'Master institutional report created successfully',
      data: masterReport,
    });
  } catch (error) {
    logger.error('Consolidate reports error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;