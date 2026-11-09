const Event = require('../models/Event');
const Publication = require('../models/Publication');
const Patent = require('../models/Patent');
const FacultyAchievement = require('../models/FacultyAchievement');
const NptelCourse = require('../models/NptelCourse');
const Newsletter = require('../models/Newsletter');
const NewsletterTemplate = require('../models/NewsletterTemplate');
const SettingsService = require('./settingsService');
const EmailService = require('./emailService');
const aiService = require('./aiService');
const logger = require('../utils/logger');

const CATEGORY_LABELS = {
  EVENTS_CONDUCTED: 'Events Conducted',
  RESOURCE_PERSON: 'Faculty as Resource Person',
  WORKSHOP_ORGANIZED: 'Student Workshops / Events Organized',
  ALUMNI_INTERACTION: 'Alumni Interaction',
  FDP_ORGANIZED: 'Faculty FDP Organized',
  SPORTS_NCC: 'Sports and NCC Events',
  OTHER: 'Other Activities',
};

// Order matches the real BMSIT&M monthly newsletter layout:
// Events -> Resource Person -> Faculty Achievements -> Workshops ->
// Alumni -> FDP -> Publications -> Patents -> Sports & NCC (last).
// Achievements/Publications/Patents come from separate models and are
// spliced in around these two groups inside generateNewsletterHTML —
// SPORTS_NCC is deliberately excluded here and rendered on its own,
// after Patents, instead of inline with the other event categories.
const CATEGORY_ORDER_BEFORE_ACHIEVEMENTS = ['EVENTS_CONDUCTED', 'RESOURCE_PERSON'];

const CATEGORY_ORDER_BEFORE_NPTEL = [
  'WORKSHOP_ORGANIZED',
  'ALUMNI_INTERACTION',
  'FDP_ORGANIZED',
];

// OTHER is a catch-all and doesn't have a fixed slot in the real
// newsletter, so it renders after NPTEL rather than interrupting the
// FDP -> NPTEL pairing (both are faculty-upskilling sections).
const CATEGORY_ORDER_AFTER_NPTEL = ['OTHER'];

const APP_URL = process.env.APP_URL || 'http://localhost:5000';

// Escape user-entered text before it goes into the newsletter HTML,
// so a title like <script>…</script> shows as plain text instead of running.
const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

class NewsletterService {
  static async getDefaultTemplate() {
    const mprTemplate = await NewsletterTemplate.findOne({ isMprTemplate: true });
    if (mprTemplate) return mprTemplate;
    return await NewsletterTemplate.findOne({ name: 'Default' });
  }

  static async generateNewsletter(startDate, endDate, templateId, createdBy, departmentId = null) {
    try {
      const settings = await SettingsService.getSettings();

      // End date is inclusive: count everything up to 23:59:59 on that day.
      const endOfDay = new Date(endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      const dateFilter = { $gte: new Date(startDate), $lte: endOfDay };

      // Department newsletter: only that department's content.
      // No departmentId (Super Admin only) = college-wide.
      const deptFilter = departmentId ? { department: departmentId } : {};
      const eventDeptFilter = departmentId
        ? { $or: [{ department: departmentId }, { coDepartments: departmentId }] }
        : {};

      const [events, publications, patents, achievements, nptelCourses] = await Promise.all([
        Event.find({ status: 'APPROVED', eventDate: dateFilter, departmentVisible: true, ...eventDeptFilter })
          .populate('department')
          .populate('coDepartments', 'name')
          .sort({ eventDate: 1 }),
        Publication.find({ status: 'APPROVED', createdAt: dateFilter, ...deptFilter })
          .populate('department')
          .sort({ createdAt: 1 }),
        Patent.find({ status: 'APPROVED', createdAt: dateFilter, ...deptFilter })
          .populate('department')
          .sort({ createdAt: 1 }),
        FacultyAchievement.find({ status: 'APPROVED', createdAt: dateFilter, ...deptFilter })
          .populate('department')
          .populate('submittedBy', 'firstName lastName')
          .sort({ createdAt: 1 }),
        // NptelCourse has no approval `status` field on its schema — it's
        // logged directly, not routed through the review workflow — so
        // this filters by completionDate only.
        NptelCourse.find({ completionDate: dateFilter, ...deptFilter })
          .populate('department')
          .populate('faculty', 'firstName lastName')
          .sort({ completionDate: 1 }),
      ]);

      if (
        events.length === 0 &&
        publications.length === 0 &&
        patents.length === 0 &&
        achievements.length === 0 &&
        nptelCourses.length === 0
      ) {
        throw new Error('No approved content found for this period');
      }

      let template;
      if (templateId) {
        template = await NewsletterTemplate.findById(templateId);
        if (!template) throw new Error('Template not found');
      } else {
        template = await this.getDefaultTemplate();
      }
      if (!template) {
        throw new Error(
          'No newsletter template found. Please create one, or ask an admin to designate an MPR template.'
        );
      }

      const groupedByCategory = {};
      events.forEach((event) => {
        const cat = event.activityCategory || 'EVENTS_CONDUCTED';
        if (!groupedByCategory[cat]) groupedByCategory[cat] = [];
        groupedByCategory[cat].push(event);
      });

      const compiledHtml = this.generateNewsletterHTML({
        settings,
        groupedByCategory,
        publications,
        patents,
        achievements,
        nptelCourses,
        startDate,
        endDate,
      });

      const newsletterName = `${settings.instituteName} Newsletter — Volume ${settings.currentVolume}, Issue ${settings.currentIssue}`;

      const newsletter = new Newsletter({
        name: newsletterName,
        description: `Newsletter covering ${startDate} to ${endDate}`,
        compiledHtml,
        template: template._id,
        periodStartDate: startDate,
        periodEndDate: endDate,
        status: 'DRAFT',
        createdBy,
        department: departmentId || undefined,
        includedEvents: events.map((event, idx) => ({ eventId: event._id, position: idx })),
        includedPublications: publications.map((pub, idx) => ({
          publicationId: pub._id,
          position: idx,
        })),
        recipients: {
          // Department newsletter goes to that department's faculty and
          // coordinators. A college-wide one (Super Admin only) also
          // goes to Super Admins.
          roles: departmentId ? ['FACULTY', 'COORDINATOR'] : ['FACULTY', 'COORDINATOR', 'SUPER_ADMIN'],
          // Empty = no department filter, so a college-wide issue reaches everyone.
          departments: departmentId ? [departmentId] : [],
          // Number of items compiled into this issue (not a recipient count).
          totalCount:
            events.length + publications.length + patents.length + achievements.length + nptelCourses.length,
        },
      });

      await newsletter.save();

      template.usageCount = (template.usageCount || 0) + 1;
      template.lastUsedAt = new Date();
      await template.save();

      // Auto-advance the issue counter so the next generated newsletter
      // doesn't need manual renumbering in Settings every time.
      await SettingsService.updateSettings({ currentIssue: settings.currentIssue + 1 }, createdBy);

      logger.info(`Newsletter generated: ${newsletter._id}`);

      return newsletter;
    } catch (error) {
      logger.error('Generate newsletter error:', error.message);
      throw error;
    }
  }

  // Kept for possible future use (e.g. an optional narrative summary
  // feature) but no longer called from the main generation path — a
  // formal MPR report needs reliable structure more than AI-generated
  // prose, so the deterministic template above is now authoritative.
  static async generateAIDraft(events, instituteName) {
    const deptNames = [...new Set(events.map((e) => e.department?.name).filter(Boolean))];
    const departmentName = deptNames.length === 1 ? deptNames[0] : instituteName;

    return aiService.generateNewsletterDraft(events, departmentName);
  }

  static generateNewsletterHTML({
    settings,
    groupedByCategory,
    publications,
    patents,
    achievements,
    nptelCourses,
    startDate,
    endDate,
  }) {
    const monthYear = new Date(startDate).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    let html = `
      <html>
        <body style="font-family: Georgia, 'Times New Roman', serif; max-width: 800px; margin: 0 auto; color: #1a1a1a;">
    `;

    html += this.renderCoverPage(settings, monthYear);
    html += this.renderMasthead(settings);

    CATEGORY_ORDER_BEFORE_ACHIEVEMENTS.forEach((catKey) => {
      const items = groupedByCategory[catKey];
      if (items && items.length > 0) {
        html += this.renderCategorySection(CATEGORY_LABELS[catKey], items);
      }
    });

    if (achievements.length > 0) {
      html += this.renderAchievementsSection(achievements);
    }

    CATEGORY_ORDER_BEFORE_NPTEL.forEach((catKey) => {
      const items = groupedByCategory[catKey];
      if (items && items.length > 0) {
        html += this.renderCategorySection(CATEGORY_LABELS[catKey], items);
      }
    });

    if (nptelCourses.length > 0) {
      html += this.renderNptelHTML(nptelCourses);
    }

    CATEGORY_ORDER_AFTER_NPTEL.forEach((catKey) => {
      const items = groupedByCategory[catKey];
      if (items && items.length > 0) {
        html += this.renderCategorySection(CATEGORY_LABELS[catKey], items);
      }
    });

    if (publications.length > 0) {
      html += this.renderPublicationsHTML(publications);
    }

    if (patents.length > 0) {
      html += this.renderPatentsHTML(patents);
    }

    const sportsItems = groupedByCategory['SPORTS_NCC'];
    if (sportsItems && sportsItems.length > 0) {
      html += this.renderCategorySection(CATEGORY_LABELS['SPORTS_NCC'], sportsItems);
    }

    html += this.renderFooter(settings);

    html += `
        </body>
      </html>
    `;

    return html;
  }

  static renderCoverPage(settings, monthYear) {
    return `
      <div style="background:#1B2340; color:#fff; padding:40px; text-align:center;">
        <h1 style="margin:0; font-size:32px;">${esc(settings.instituteName)}</h1>
        <p style="margin:8px 0 0 0; font-size:14px; letter-spacing:1px; color:#C9962C;">
          Volume ${settings.currentVolume} &nbsp;|&nbsp; Issue ${settings.currentIssue} &nbsp;|&nbsp; ${monthYear}
        </p>
      </div>
      ${
        settings.vision || settings.mission
          ? `
      <div style="display:flex; gap:20px; padding:24px 40px; background:#FAF8F5;">
        ${
          settings.vision
            ? `<div style="flex:1;"><h3 style="margin:0 0 6px 0; font-size:14px;">Vision</h3><p style="margin:0; font-size:13px; line-height:1.5;">${esc(settings.vision)}</p></div>`
            : ''
        }
        ${
          settings.mission
            ? `<div style="flex:1;"><h3 style="margin:0 0 6px 0; font-size:14px;">Mission</h3><p style="margin:0; font-size:13px; line-height:1.5;">${esc(settings.mission)}</p></div>`
            : ''
        }
      </div>`
          : ''
      }
    `;
  }

  static renderMasthead(settings) {
    const board = settings.editorialBoard?.length
      ? `
      <div style="padding:16px 40px; background:#F5F6F8; font-size:12px; text-align:center;">
        <strong>Editorial Board:</strong>
        ${settings.editorialBoard.map((m) => `${esc(m.name)} (${esc(m.role)})`).join(' &middot; ')}
      </div>`
      : '';

    const contact = `
      <div style="padding:12px 40px; font-size:11px; color:#666; text-align:center;">
        ${settings.address ? `${esc(settings.address)}<br/>` : ''}
        ${settings.phone ? `Phone: ${esc(settings.phone)} &nbsp;` : ''}
        ${settings.email ? `Email: ${esc(settings.email)} &nbsp;` : ''}
        ${settings.website ? `Website: ${esc(settings.website)}` : ''}
      </div>
    `;

    const presenter = settings.principalName
      ? `<p style="text-align:center; font-size:12px; color:#666; padding:0 40px 16px;">
           Presented by <strong>${esc(settings.principalName)}</strong>, ${esc(settings.principalTitle)}
         </p>`
      : '';

    return board + contact + presenter;
  }

  static renderCategorySection(label, items) {
    let html = `
      <div style="padding:24px 40px 8px;">
        <h2 style="background:#FBEBC9; padding:8px 12px; font-size:16px; margin:0 0 16px 0; border-left:4px solid #C9962C;">
          ${label}
        </h2>
    `;

    items.forEach((item) => {
      html += `
        <div style="margin-bottom:20px;">
          <p style="margin:0 0 8px 0; font-size:14px; line-height:1.6;">
            <strong>${esc(item.eventName)}</strong> — ${esc(item.description)}
            ${
              item.coDepartments?.length
                ? ` <em>(Jointly organized with ${esc(item.coDepartments.map((d) => d.name).join(', '))})</em>`
                : ''
            }
          </p>
      `;

      if (item.photos?.length > 0) {
        html += `<div style="display:flex; gap:10px; margin-top:8px;">`;
        item.photos.slice(0, 2).forEach((photo) => {
          html += `<img src="${esc(APP_URL + photo.url)}" style="width:48%; height:auto; border-radius:4px;" />`;
        });
        html += `</div>`;
      }

      if (item.participants?.length > 0) {
        html += `
          <table style="width:100%; font-size:11px; border-collapse:collapse; margin-top:8px;">
            <thead>
              <tr style="background:#F5F6F8;">
                <th style="text-align:left; padding:4px; border:1px solid #E4E7EC;">USN</th>
                <th style="text-align:left; padding:4px; border:1px solid #E4E7EC;">Name</th>
                <th style="text-align:left; padding:4px; border:1px solid #E4E7EC;">Department</th>
              </tr>
            </thead>
            <tbody>
              ${item.participants
                .map(
                  (p) => `
                <tr>
                  <td style="padding:4px; border:1px solid #E4E7EC;">${esc(p.usn)}</td>
                  <td style="padding:4px; border:1px solid #E4E7EC;">${esc(p.name)}</td>
                  <td style="padding:4px; border:1px solid #E4E7EC;">${esc(p.department)}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        `;
      }

      html += `</div>`;
    });

    html += `</div>`;
    return html;
  }

  static renderAchievementsSection(achievements) {
    let html = `
      <div style="padding:24px 40px 8px;">
        <h2 style="background:#FBEBC9; padding:8px 12px; font-size:16px; margin:0 0 16px 0; border-left:4px solid #C9962C;">
          Faculty Achievements
        </h2>
    `;

    achievements.forEach((a) => {
      const facultyName = a.submittedBy ? esc(`${a.submittedBy.firstName} ${a.submittedBy.lastName}`) : '';
      html += `
        <p style="margin:0 0 10px 0; font-size:14px; line-height:1.6;">
          <strong>${facultyName}</strong>, ${esc(a.department?.name || '')} — ${esc(a.description)}
          ${a.awardingBody ? ` (${esc(a.awardingBody)})` : ''}
        </p>
      `;
    });

    html += `</div>`;
    return html;
  }

  static renderNptelHTML(nptelCourses) {
    let html = `
      <div style="padding:24px 40px 8px;">
        <h2 style="background:#FBEBC9; padding:8px 12px; font-size:16px; margin:0 0 16px 0; border-left:4px solid #C9962C;">
          NPTEL Courses Completed
        </h2>
    `;

    nptelCourses.forEach((course) => {
      const facultyName = course.faculty ? esc(`${course.faculty.firstName} ${course.faculty.lastName}`) : '';
      const deptName = esc(course.department?.name || '');
      const completion = course.completionDate ? new Date(course.completionDate).toLocaleDateString() : '';
      const scoreLine = course.score ? ` with a score of ${esc(course.score)}` : '';
      const certLine = course.certificateEarned ? ' and earned the certificate' : '';

      html += `
        <p style="margin:0 0 10px 0; font-size:13px; line-height:1.6;">
          <strong>${facultyName}</strong>, ${deptName} completed the ${esc(course.platform || 'NPTEL')} course
          &quot;${esc(course.courseName)}&quot;${course.duration ? ` (${esc(course.duration)})` : ''}${completion ? ` on ${completion}` : ''}${scoreLine}${certLine}.
        </p>
      `;
    });

    html += `</div>`;
    return html;
  }

  static renderPublicationsHTML(publications) {
    let html = `
      <div style="padding:24px 40px 8px;">
        <h2 style="background:#FBEBC9; padding:8px 12px; font-size:16px; margin:0 0 16px 0; border-left:4px solid #C9962C;">
          International Journal / Conference / Book Chapter / Book Publications
        </h2>
    `;

    publications.forEach((pub) => {
      const authors = esc(pub.authors.join(', '));
      const indexing = pub.indexing?.length ? ` (Indexed in ${esc(pub.indexing.join(', '))})` : '';
      const doi = pub.doi ? ` DOI: ${esc(pub.doi)}.` : '';
      const conferenceDates = pub.conferenceStartDate
        ? pub.conferenceEndDate &&
          new Date(pub.conferenceEndDate).toDateString() !== new Date(pub.conferenceStartDate).toDateString()
          ? `, ${new Date(pub.conferenceStartDate).toLocaleDateString()}–${new Date(pub.conferenceEndDate).toLocaleDateString()}`
          : `, ${new Date(pub.conferenceStartDate).toLocaleDateString()}`
        : '';

      const venueLine =
        pub.publicationType === 'CONFERENCE' && pub.conferenceVenue
          ? `${esc(pub.venueName)}, ${esc(pub.conferenceVenue)}${conferenceDates}.`
          : `${esc(pub.venueName)}.`;

      html += `
        <p style="margin:0 0 10px 0; font-size:13px; line-height:1.6;">
          ${authors}. &quot;${esc(pub.title)}.&quot; ${venueLine}${doi}${indexing}
        </p>
      `;
    });

    html += `</div>`;
    return html;
  }

  static renderPatentsHTML(patents) {
    let html = `
      <div style="padding:24px 40px 8px;">
        <h2 style="background:#FBEBC9; padding:8px 12px; font-size:16px; margin:0 0 16px 0; border-left:4px solid #C9962C;">
          Patents Published / Granted
        </h2>
    `;

    patents.forEach((p) => {
      html += `
        <p style="margin:0 0 10px 0; font-size:13px; line-height:1.6;">
          ${esc(p.inventors.join(', '))} has been ${p.grantStatus === 'GRANTED' ? 'granted' : esc(String(p.grantStatus).toLowerCase()) + ' for'} a patent titled
          &quot;${esc(p.title)}&quot; by ${esc(p.grantingAuthority)}${
        p.grantDate ? ` on ${new Date(p.grantDate).toLocaleDateString()}` : ''
      }.
        </p>
      `;
    });

    html += `</div>`;
    return html;
  }

  static renderFooter(settings) {
    return `
      <div style="background:#1B2340; color:#fff; padding:24px 40px; text-align:center; margin-top:20px;">
        <p style="margin:0; font-size:12px;">&copy; ${esc(settings.instituteName)}</p>
      </div>
    `;
  }

  static async getAllNewsletters(page = 1, limit = 10, filters = {}) {
    try {
      const skip = (page - 1) * limit;
      const query = {};
      if (filters.status) query.status = filters.status;
      if (filters.createdBy) query.createdBy = filters.createdBy;
      if (filters.department) query.department = filters.department;
      if (filters.$or) query.$or = filters.$or;
      if (filters.department) query.department = filters.department;

      const [newsletters, total] = await Promise.all([
        Newsletter.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'firstName lastName')
          .populate('department', 'name'),
        Newsletter.countDocuments(query),
      ]);

      return {
        newsletters,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
        },
      };
    } catch (error) {
      logger.error('Get newsletters error:', error.message);
      throw error;
    }
  }

  static async getNewsletterById(id) {
    try {
      const newsletter = await Newsletter.findById(id)
        .populate('createdBy', 'firstName lastName email')
        .populate('publishedBy', 'firstName lastName email')
        .populate('department', 'name')
        .populate('includedEvents.eventId', 'eventName eventDate');

      if (!newsletter) {
        throw new Error('Newsletter not found');
      }

      return newsletter;
    } catch (error) {
      logger.error('Get newsletter error:', error.message);
      throw error;
    }
  }

  static async scheduleNewsletter(id, scheduledFor) {
    try {
      const when = new Date(scheduledFor);
      if (Number.isNaN(when.getTime())) throw new Error('Invalid schedule date');
      if (when.getTime() <= Date.now()) throw new Error('Choose a date and time in the future');

      // Only drafts (or an already scheduled one being re-timed) can be scheduled.
      const newsletter = await Newsletter.findOneAndUpdate(
        { _id: id, status: { $in: ['DRAFT', 'SCHEDULED'] } },
        { status: 'SCHEDULED', scheduledFor: when },
        { new: true }
      );
      if (!newsletter) {
        const exists = await Newsletter.exists({ _id: id });
        throw new Error(exists ? 'Only draft or scheduled newsletters can be scheduled' : 'Newsletter not found');
      }

      logger.info(`Newsletter scheduled: ${id} for ${when.toISOString()}`);

      return newsletter;
    } catch (error) {
      logger.error('Schedule newsletter error:', error.message);
      throw error;
    }
  }

  static async publishNewsletter(id, publishedBy) {
    try {
      const current = await Newsletter.findById(id).select('status');
      if (!current) throw new Error('Newsletter not found');
      const previousStatus = current.status;

      // Atomic claim: only one caller can move DRAFT/SCHEDULED to PUBLISHED,
      // so a double click or the scheduler racing a manual publish can't
      // send the same newsletter twice.
      const newsletter = await Newsletter.findOneAndUpdate(
        { _id: id, status: { $in: ['DRAFT', 'SCHEDULED'] } },
        { status: 'PUBLISHED', publishedAt: new Date(), publishedBy },
        { new: true }
      );
      if (!newsletter) throw new Error('This newsletter is already published or cannot be published');

      try {
        const deliveryResult = await EmailService.sendNewsletterToRecipients(newsletter);
        newsletter.deliveryStats.totalSent = deliveryResult.totalSent;
        newsletter.deliveryStats.delivered = deliveryResult.delivered;
        newsletter.deliveryStats.bounced = deliveryResult.bounced;
        await newsletter.save();
      } catch (sendError) {
        // Sending failed: put it back so it is not wrongly shown as published.
        // A failed scheduled send goes back to DRAFT so the scheduler does not
        // retry it forever every 5 minutes.
        await Newsletter.updateOne(
          { _id: id },
          {
            status: publishedBy ? previousStatus : 'DRAFT',
            $unset: { publishedAt: '', publishedBy: '', ...(publishedBy ? {} : { scheduledFor: '' }) },
          }
        );
        throw sendError;
      }

      logger.info(`Newsletter published: ${id}`);

      return newsletter;
    } catch (error) {
      logger.error('Publish newsletter error:', error.message);
      throw error;
    }
  }

  static async deleteNewsletter(id) {
    try {
      const newsletter = await Newsletter.findById(id).select('status');
      if (!newsletter) throw new Error('Newsletter not found');
      if (newsletter.status === 'PUBLISHED') {
        throw new Error('A published newsletter cannot be deleted');
      }

      await Newsletter.deleteOne({ _id: id });

      return { message: 'Newsletter deleted successfully' };
    } catch (error) {
      logger.error('Delete newsletter error:', error.message);
      throw error;
    }
  }
}

module.exports = NewsletterService;