const Event = require('../models/Event');
const Publication = require('../models/Publication');
const Patent = require('../models/Patent');
const FacultyAchievement = require('../models/FacultyAchievement');
const sendgridService = require('./sendgridService');
const logger = require('../utils/logger');

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const oneLine = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();

const TYPES = [
  { key: 'events', label: 'Events', model: Event },
  { key: 'publications', label: 'Publications', model: Publication },
  { key: 'patents', label: 'Patents', model: Patent },
  { key: 'achievements', label: 'Achievements', model: FacultyAchievement },
];

// Counts, for the given period, the items approved (by when they were last
// updated to APPROVED) and the items still waiting for a decision.
async function collectStats(start, end) {
  const from = new Date(start);
  const to = new Date(end);
  to.setUTCHours(23, 59, 59, 999);

  const totals = {};
  const byDepartment = new Map();
  let pending = 0;

  for (const type of TYPES) {
    const approved = await type.model
      .find({ status: 'APPROVED', updatedAt: { $gte: from, $lte: to } })
      .select('department')
      .populate('department', 'name')
      .lean();

    totals[type.key] = approved.length;

    for (const item of approved) {
      const name = item.department?.name || 'No department';
      const row = byDepartment.get(name) || { name, total: 0 };
      row.total += 1;
      byDepartment.set(name, row);
    }

    pending += await type.model.countDocuments({ status: 'SUBMITTED' });
  }

  const approvedTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  const departments = [...byDepartment.values()].sort((a, b) => b.total - a.total);
  return { totals, approvedTotal, departments, pending };
}

function buildHtml({ admin, monthLabel, stats, newsletter }) {
  const baseUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || '').replace(/\/$/, '');
  const link = `${baseUrl}/newsletters`;

  const typeRows = TYPES.map(
    (t) =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${t.label}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">${stats.totals[t.key]}</td></tr>`
  ).join('');

  const deptRows = stats.departments.length
    ? stats.departments
        .map(
          (d) =>
            `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${escapeHtml(d.name)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">${d.total}</td></tr>`
        )
        .join('')
    : '<tr><td style="padding:6px 12px;" colspan="2">Nothing was approved this month.</td></tr>';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#1B2340;">
      <h2 style="margin-bottom:4px;">${escapeHtml(monthLabel)} summary</h2>
      <p>Hi ${escapeHtml(admin.firstName)},</p>
      <p><strong>${stats.approvedTotal}</strong> item${stats.approvedTotal === 1 ? ' was' : 's were'} approved this month.
      ${stats.pending ? `<strong>${stats.pending}</strong> still waiting for a Coordinator's decision.` : 'Nothing is waiting for approval.'}</p>
      <h3 style="margin-bottom:6px;">By type</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${typeRows}</table>
      <h3 style="margin-bottom:6px;">By department</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${deptRows}</table>
      <p style="margin-top:20px;">${
        newsletter
          ? 'The college newsletter draft is ready for your review.'
          : 'The newsletter draft could not be created automatically; you can create it manually.'
      }</p>
      <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#C9962C;color:#1B2340;text-decoration:none;border-radius:6px;font-weight:bold;">Open Newsletters</a></p>
      <p style="color:#667085;font-size:12px;">— CNMS</p>
    </div>
  `;
}

// Emails each Super Admin the month's summary. Never throws.
async function sendMonthlyDigest({ admins, start, end, monthLabel, newsletter = null }) {
  const result = { sent: 0, failed: 0 };
  try {
    const stats = await collectStats(start, end);

    for (const admin of admins) {
      try {
        await sendgridService.send({
          to: admin.email,
          subject: oneLine(`${monthLabel}: ${stats.approvedTotal} approved items, newsletter ${newsletter ? 'draft ready' : 'needs attention'}`),
          html: buildHtml({ admin, monthLabel, stats, newsletter }),
        });
        result.sent += 1;
      } catch (error) {
        result.failed += 1;
        logger.error(`Monthly digest email failed for ${admin.email}: ${error.message}`);
      }
    }
    logger.info(`Monthly digest for ${monthLabel}: ${result.sent} sent, ${result.failed} failed`);
  } catch (error) {
    logger.error(`Monthly digest error: ${error.message}`);
  }
  return result;
}

module.exports = { sendMonthlyDigest };