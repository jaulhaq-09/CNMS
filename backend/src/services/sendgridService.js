const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

// Port 587 (STARTTLS) gets through many networks that block port 465.
// Override with GMAIL_PORT / GMAIL_SECURE in .env if needed.
const gmailPort = Number(process.env.GMAIL_PORT) || 587;

const fallbackTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: gmailPort,
  secure: gmailPort === 465,
  requireTLS: gmailPort !== 465,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
  },
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

// Brevo transactional email over HTTPS.
async function sendViaBrevo({ to, subject, html, attachments = [] }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'CNMS', email: process.env.MAIL_FROM },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(attachments.length
        ? { attachment: attachments.map((a) => ({ name: a.filename, content: a.content })) }
        : {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Brevo ${response.status}: ${detail.slice(0, 200)}`);
  }
}

class SendgridService {
  static async send({ to, subject, html, attachments = [] }) {
    const useSendgrid = !!process.env.SENDGRID_API_KEY;

    try {
      if (process.env.BREVO_API_KEY) {
        await sendViaBrevo({ to, subject, html, attachments });
        logger.info(`Email sent via Brevo to ${to}`);
      } else if (useSendgrid) {
        await sgMail.send({
          to,
          from: process.env.MAIL_FROM || 'noreply@college.edu',
          subject,
          html,
          attachments: attachments.map((a) => ({
            content: a.content,
            filename: a.filename,
            type: a.type,
            disposition: a.disposition || 'attachment',
          })),
        });
        logger.info(`Email sent via SendGrid to ${to}`);
      } else {
        await fallbackTransporter.sendMail({
          from: `CNMS <${process.env.GMAIL_USER}>`,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content, 'base64'),
            contentType: a.type,
          })),
          to,
          subject,
          html,
        });
        logger.info(`Email sent via Gmail fallback to ${to}`);
      }
      return true;
    } catch (error) {
      logger.error(`Email send failed to ${to}:`, error.message);
      throw error;
    }
  }
}

module.exports = SendgridService;