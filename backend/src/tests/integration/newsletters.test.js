const mongoose = require('mongoose');
require('dotenv').config();
const request = require('supertest');

jest.mock('../../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendPasswordChangedEmail: jest.fn().mockResolvedValue(true),
  sendTwoFactorEnabledEmail: jest.fn().mockResolvedValue(true),
  sendSuspiciousLoginAlert: jest.fn().mockResolvedValue(true),
  sendEventApprovedEmail: jest.fn().mockResolvedValue(true),
  sendEventRejectedEmail: jest.fn().mockResolvedValue(true),
  sendNewsletterEmail: jest.fn().mockResolvedValue(true),
  sendNewsletterToRecipients: jest.fn().mockResolvedValue({
    totalSent: 2,
    delivered: 2,
    bounced: 0,
  }),
}));

// Forces the AI path to fail so every test run deterministically exercises
// the hardcoded-HTML fallback instead of depending on a live Groq API call.
jest.mock('../../services/aiService', () => ({
  generateNewsletterDraft: jest.fn().mockRejectedValue(new Error('AI unavailable in tests')),
}));

const app = require('../../app');
const User = require('../../models/User');
const Department = require('../../models/Department');
const NewsletterTemplate = require('../../models/NewsletterTemplate');
const { connectTestDB, clearTestDB, closeTestDB } = require('../testDb');

beforeAll(async () => {
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

async function createUserWithRole({ email, role, department, clusters = [], sections = [] }) {
  const user = new User({
    email,
    password: 'SecurePass123',
    firstName: 'Test',
    lastName: role,
    role,
    department,
    clusters,
    sections,
    emailVerified: true,
  });
  await user.save();

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'SecurePass123' });

  return { user, token: loginRes.body.data.token };
}

describe('Newsletter flow', () => {
  let department, faculty, coordinator, dean;

  beforeEach(async () => {
    department = await Department.create({ name: 'Computer Science', code: 'CS' });

    // 'Default' template is required by NewsletterService.getDefaultTemplate()
    // whenever no templateId is passed in.
    await NewsletterTemplate.create({
      name: 'Default',
      structure: { blocks: [] },
      createdBy: new mongoose.Types.ObjectId(),
    });

    faculty = await createUserWithRole({
      email: 'faculty@college.edu',
      role: 'FACULTY',
      department: department._id,
      clusters: ['AI'],
      sections: ['A'],
    });

    coordinator = await createUserWithRole({
      email: 'coordinator@college.edu',
      role: 'COORDINATOR',
      department: department._id,
      clusters: ['AI'],
    });
  });

  async function createApprovedEvent() {
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({
        eventName: 'AI Workshop',
        description: 'A hands-on workshop on machine learning basics.',
        eventType: 'Workshop',
        cluster: 'AI',
        section: 'A',
        eventDate: '2026-09-01',
      });
    const eventId = createRes.body.data._id;

    await request(app)
      .post(`/api/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    await request(app)
      .post(`/api/events/${eventId}/approve`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({ feedback: 'Looks good.' });

    return eventId;
  }

  it('rejects generate with COORDINATOR-only permission now allowed (regression: was SUPER_ADMIN-only)', async () => {
    await createApprovedEvent();

    const res = await request(app)
      .post('/api/newsletters/generate')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        startDate: '2026-08-01',
        endDate: '2026-09-30',
      });

    // Regression test for the fixed permission bug — COORDINATOR must be
    // allowed here, not rejected with 403.
    expect(res.status).toBe(201);
  });

  it('rejects generate for FACULTY (not authorized)', async () => {
    await createApprovedEvent();

    const res = await request(app)
      .post('/api/newsletters/generate')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({
        startDate: '2026-08-01',
        endDate: '2026-09-30',
      });

    expect(res.status).toBe(403);
  });

  it('generates a newsletter using the fallback HTML when AI fails', async () => {
    await createApprovedEvent();

    const res = await request(app)
      .post('/api/newsletters/generate')
      .set('Authorization', `Bearer ${dean.token}`)
      .send({
        startDate: '2026-08-01',
        endDate: '2026-09-30',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.compiledHtml).toContain('AI Workshop');
  });

  it('fails to generate when there are no approved events in range', async () => {
    const res = await request(app)
      .post('/api/newsletters/generate')
      .set('Authorization', `Bearer ${dean.token}`)
      .send({
        startDate: '2026-08-01',
        endDate: '2026-09-30',
      });

    expect(res.status).toBe(400);
  });

  it('takes a newsletter through publish and records real delivery stats', async () => {
    await createApprovedEvent();

    const genRes = await request(app)
      .post('/api/newsletters/generate')
      .set('Authorization', `Bearer ${dean.token}`)
      .send({ startDate: '2026-08-01', endDate: '2026-09-30' });

    const newsletterId = genRes.body.data._id;

    const publishRes = await request(app)
      .post(`/api/newsletters/${newsletterId}/publish`)
      .set('Authorization', `Bearer ${dean.token}`);

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.status).toBe('PUBLISHED');
    // Regression test: deliveryStats used to be hardcoded to 1000
    // regardless of actual recipients — now it should reflect the mocked
    // sendNewsletterToRecipients() return value.
    expect(publishRes.body.data.deliveryStats.totalSent).toBe(2);
    expect(publishRes.body.data.deliveryStats.delivered).toBe(2);
  });

  it('rejects publish for COORDINATOR (SUPER_ADMIN only)', async () => {
    await createApprovedEvent();

    const genRes = await request(app)
      .post('/api/newsletters/generate')
      .set('Authorization', `Bearer ${dean.token}`)
      .send({ startDate: '2026-08-01', endDate: '2026-09-30' });

    const newsletterId = genRes.body.data._id;

    const publishRes = await request(app)
      .post(`/api/newsletters/${newsletterId}/publish`)
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(publishRes.status).toBe(403);
  });

  it('schedules a newsletter for a future date', async () => {
    await createApprovedEvent();

    const genRes = await request(app)
      .post('/api/newsletters/generate')
      .set('Authorization', `Bearer ${dean.token}`)
      .send({ startDate: '2026-08-01', endDate: '2026-09-30' });

    const newsletterId = genRes.body.data._id;
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const scheduleRes = await request(app)
      .post(`/api/newsletters/${newsletterId}/schedule`)
      .set('Authorization', `Bearer ${dean.token}`)
      .send({ scheduledFor });

    expect(scheduleRes.status).toBe(200);
    expect(scheduleRes.body.data.status).toBe('SCHEDULED');
  });
});