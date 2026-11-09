const sendgridService = require('./sendgridService'); // reuses the sender from Phase A
const emailTemplates = require('../utils/emailTemplates');
const logger = require('../utils/logger');
const User = require('../models/User');

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Strips line breaks so user-supplied text can never inject extra email headers.
const oneLine = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();

class EmailService {
  static async sendVerificationEmail(user, token) {
    const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
    const { subject, html } = emailTemplates.verifyEmail(user.firstName, verifyUrl);

    await sendgridService.send({ to: user.email, subject, html });
    logger.info(`Verification email sent to ${user.email}`);
  }

  static async sendPasswordResetEmail(user, token) {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    const { subject, html } = emailTemplates.passwordReset(user.firstName, resetUrl);

    await sendgridService.send({ to: user.email, subject, html });
    logger.info(`Password reset email sent to ${user.email}`);
  }

  static async sendPasswordChangedEmail(user) {
    const { subject, html } = emailTemplates.passwordChanged(user.firstName);
    await sendgridService.send({ to: user.email, subject, html });
  }

  static async sendTwoFactorEnabledEmail(user) {
    const { subject, html } = emailTemplates.twoFactorEnabled(user.firstName);
    await sendgridService.send({ to: user.email, subject, html });
  }

  static async sendSuspiciousLoginAlert(user, ipAddress) {
    const { subject, html } = emailTemplates.suspiciousLogin(user.firstName, ipAddress);
    await sendgridService.send({ to: user.email, subject, html });
  }

  static async sendEventApprovedEmail(user, event) {
    const subject = `Your event "${event.eventName}" was approved`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Event Approved</h2>
        <p>Hi ${user.firstName},</p>
        <p>Your event <strong>${event.eventName}</strong> scheduled for
        ${new Date(event.eventDate).toDateString()} has been approved and is now visible
        to your department.</p>
        <p>— CNMS</p>
      </div>
    `;
    await sendgridService.send({ to: user.email, subject, html });
    logger.info(`Event approved email sent to ${user.email}`);
  }

  static async sendEventRejectedEmail(user, event, feedback) {
    const subject = `Your event "${event.eventName}" needs changes`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Event Not Approved</h2>
        <p>Hi ${user.firstName},</p>
        <p>Your event <strong>${event.eventName}</strong> was not approved.</p>
        <p><strong>Feedback:</strong> ${feedback}</p>
        <p>You're welcome to revise and resubmit it.</p>
        <p>— CNMS</p>
      </div>
    `;
    await sendgridService.send({ to: user.email, subject, html });
    logger.info(`Event rejected email sent to ${user.email}`);
  }

  static async sendPublicationApprovedEmail(user, publication) {
    const subject = `Your publication "${publication.title}" was approved`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Publication Approved</h2>
        <p>Hi ${user.firstName},</p>
        <p>Your publication <strong>${publication.title}</strong> has been approved and will
        be included in the upcoming newsletter.</p>
        <p>— CNMS</p>
      </div>
    `;
    await sendgridService.send({ to: user.email, subject, html });
    logger.info(`Publication approved email sent to ${user.email}`);
  }

  static async sendPublicationRejectedEmail(user, publication, feedback) {
    const subject = `Your publication "${publication.title}" needs changes`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Publication Not Approved</h2>
        <p>Hi ${user.firstName},</p>
        <p>Your publication <strong>${publication.title}</strong> was not approved.</p>
        <p><strong>Feedback:</strong> ${feedback}</p>
        <p>You're welcome to revise and resubmit it.</p>
        <p>— CNMS</p>
      </div>
    `;
    await sendgridService.send({ to: user.email, subject, html });
    logger.info(`Publication rejected email sent to ${user.email}`);
  }
    // Tells the person who submitted a patent or achievement how it was decided.
  static async sendItemDecisionEmail(user, { itemLabel, title, approved, feedback }) {
    const subject = approved
      ? `Your ${oneLine(itemLabel)} "${oneLine(title)}" was approved`
      : `Your ${oneLine(itemLabel)} "${oneLine(title)}" needs changes`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${approved ? 'Approved' : 'Not approved'}</h2>
        <p>Hi ${escapeHtml(user.firstName)},</p>
        <p>Your ${escapeHtml(itemLabel)} <strong>${escapeHtml(title)}</strong> ${
          approved ? 'has been approved.' : 'was not approved.'
        }</p>
        ${feedback ? `<p><strong>Feedback:</strong> ${escapeHtml(feedback)}</p>` : ''}
        ${approved ? '' : '<p>You\'re welcome to revise and resubmit it.</p>'}
        <p>— CNMS</p>
      </div>
    `;
    await sendgridService.send({ to: user.email, subject, html });
    logger.info(`${itemLabel} decision email sent to ${user.email}`);
  }  

  // Emails a generated report file to each recipient individually, so
  // addresses stay private. Returns counts so the caller can log them.
  static async sendReportEmail(recipients, report, file) {
    const buffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(String(file.data), 'utf8');
    const safeName = String(file.filename || 'report').replace(/[^\w.-]+/g, '-');

    const subject = `Scheduled report: ${report.name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${escapeHtml(report.name)}</h2>
        ${report.description ? `<p>${escapeHtml(report.description)}</p>` : ''}
        <p>Your scheduled report is attached to this email as <strong>${escapeHtml(safeName)}</strong>.</p>
        <p>— CNMS</p>
      </div>
    `;
    const attachments = [
      {
        content: buffer.toString('base64'),
        filename: safeName,
        type: file.mime,
        disposition: 'attachment',
      },
    ];

    let delivered = 0;
    let failed = 0;
    for (const to of recipients) {
      try {
        await sendgridService.send({ to, subject, html, attachments });
        delivered += 1;
      } catch (error) {
        failed += 1;
        logger.error(`Report email failed for ${to}:`, error.message);
      }
    }
    return { delivered, failed };
  }
  // Tells a Coordinator that a faculty member has posted or resubmitted something to review.
  static async sendApprovalRequestEmail(approver, { itemLabel, title, submitterName, departmentName, isResubmission = false }) {
    const approvalsUrl = `${process.env.CLIENT_URL}/approvals`;
    const subject = isResubmission
      ? `${oneLine(submitterName)} updated and resubmitted ${oneLine(itemLabel)} "${oneLine(title)}" for your approval`
      : `${oneLine(submitterName)} posted a new ${oneLine(itemLabel)} for your approval`;
    const heading = isResubmission
      ? `Revised ${escapeHtml(itemLabel)} awaiting approval`
      : `New ${escapeHtml(itemLabel)} awaiting approval`;
    const actionDesc = isResubmission
      ? `has updated and resubmitted`
      : `has posted`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#1B2340;">
        <h2>${heading}</h2>
        <p>Hi ${escapeHtml(approver.firstName)},</p>
        <p><strong>${escapeHtml(submitterName)}</strong> ${actionDesc}
        <strong>${escapeHtml(title)}</strong>${departmentName ? ` (${escapeHtml(departmentName)})` : ''}
        and it is waiting for your review.</p>
        <p><a href="${escapeHtml(approvalsUrl)}" style="background:#1B2340; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">Open Approvals</a></p>
        <p>— CNMS</p>
      </div>
    `;
    await sendgridService.send({ to: approver.email, subject, html });
    logger.info(`Approval request email sent to ${approver.email} (resubmission: ${isResubmission})`);
  }

  // "Forgot username": reminds the person of their login name.
  static async sendUsernameReminderEmail(user) {
    const loginUrl = `${process.env.CLIENT_URL}/login`;
    const subject = 'Your CNMS username';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#1B2340;">
        <h2>Your CNMS username</h2>
        <p>Hi ${escapeHtml(user.firstName)},</p>
        <p>Your username is your college email:</p>
        <p style="font-size:16px;"><strong>${escapeHtml(user.email)}</strong></p>
        <p><a href="${escapeHtml(loginUrl)}" style="background:#1B2340; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">Sign in</a></p>
        <p style="font-size:13px; color:#667085;">If you did not ask for this, you can ignore this email. Your password has not changed.</p>
        <p>— CNMS</p>
      </div>
    `;
    await sendgridService.send({ to: user.email, subject, html });
  }

  // Sent after the Admin imports or re-issues a faculty account.
  static async sendCredentialsEmail(user, tempPassword, expiresAt) {
    const loginUrl = `${process.env.CLIENT_URL}/login`;
    const subject = 'Your CNMS account is ready';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#1B2340;">
        <h2 style="margin-bottom:4px;">Welcome to CNMS</h2>
        <p>Hi ${escapeHtml(user.firstName)},</p>
        <p>The college administrator has created your account on the College Newsletter
        Management System. Use the details below to sign in.</p>
        <table style="border-collapse:collapse; margin:16px 0; font-size:14px;">
          <tr>
            <td style="padding:8px 14px; background:#F2F4F7; border:1px solid #E4E7EC;">Username</td>
            <td style="padding:8px 14px; border:1px solid #E4E7EC;"><strong>${escapeHtml(user.email)}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px 14px; background:#F2F4F7; border:1px solid #E4E7EC;">Temporary password</td>
            <td style="padding:8px 14px; border:1px solid #E4E7EC;"><strong style="font-family:monospace; font-size:15px;">${escapeHtml(tempPassword)}</strong></td>
          </tr>
        </table>
        <p><a href="${escapeHtml(loginUrl)}" style="background:#1B2340; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">Sign in</a></p>
        <p style="font-size:13px; color:#667085;">
          This password works once and expires on ${escapeHtml(new Date(expiresAt).toDateString())}.
          You will be asked to choose your own password when you first sign in.
          If you forget your username or password, use the "Forgot" links on the sign-in page.
        </p>
        <p>— CNMS</p>
      </div>
    `;
    await sendgridService.send({ to: user.email, subject, html });
    logger.info(`Credentials email sent to ${user.email}`);
  }

  static async sendNewsletterEmail(user, newsletter) {
    await sendgridService.send({
      to: user.email,
      subject: newsletter.name,
      html: newsletter.compiledHtml,
    });
  }

  // Resolves the newsletter's recipients.roles/departments config into
  // actual User documents, then emails each one individually (rather
  // than one email with everyone in "to") so addresses stay private.
  // Returns counts so publishNewsletter can store real numbers instead
  // of a guessed total.
  static async sendNewsletterToRecipients(newsletter) {
    const query = { isActive: true };

    if (newsletter.recipients?.roles?.length) {
      query.role = { $in: newsletter.recipients.roles };
    }
    if (newsletter.recipients?.departments?.length) {
      query.department = { $in: newsletter.recipients.departments };
    }

    const recipientUsers = await User.find(query).select('email firstName');

    let delivered = 0;
    let bounced = 0;

    for (const user of recipientUsers) {
      try {
        await this.sendNewsletterEmail(user, newsletter);
        delivered += 1;
      } catch (error) {
        bounced += 1;
        logger.error(`Newsletter email failed for ${user.email}:`, error.message);
      }
    }

    return { totalSent: recipientUsers.length, delivered, bounced };
  }
}

module.exports = EmailService;