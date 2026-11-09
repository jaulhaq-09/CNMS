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
  sendNewsletterToRecipients: jest.fn().mockResolvedValue({ totalSent: 0, delivered: 0, bounced: 0 }),
}));

jest.mock('../../services/aiService', () => ({
  generateNewsletterDraft: jest.fn().mockRejectedValue(new Error('AI unavailable in tests')),
}));

const app = require('../../app');
const User = require('../../models/User');
const Department = require('../../models/Department');
const Event = require('../../models/Event');
const Newsletter = require('../../models/Newsletter');
const NewsletterTemplate = require('../../models/NewsletterTemplate');
const mongoose = require('mongoose');
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

async function createUserWithRole({ email, role, department }) {
  const user = new User({
    email,
    password: 'SecurePass123',
    firstName: 'Test',
    lastName: role,
    role,
    department,
    emailVerified: true,
  });
  await user.save();

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'SecurePass123' });

  return { user, token: loginRes.body.data.token };
}

describe('Analytics access control', () => {
  let department, faculty, coordinator;

  beforeEach(async () => {
    department = await Department.create({ name: 'Computer Science', code: 'CS' });
    faculty = await createUserWithRole({
      email: 'faculty@college.edu',
      role: 'FACULTY',
      department: department._id,
    });
    coordinator = await createUserWithRole({
      email: 'coordinator@college.edu',
      role: 'COORDINATOR',
      department: department._id,
    });
  });

  it('rejects FACULTY from viewing the analytics dashboard', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${faculty.token}`);

    expect(res.status).toBe(403);
  });

  it('allows COORDINATOR to view the analytics dashboard', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('events');
    expect(res.body.data).toHaveProperty('newsletters');
    expect(res.body.data).toHaveProperty('activity');
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.status).toBe(401);
  });
});

describe('Analytics event stats', () => {
  let department, coordinator, faculty;

  beforeEach(async () => {
    department = await Department.create({ name: 'Computer Science', code: 'CS' });
    coordinator = await createUserWithRole({
      email: 'coordinator@college.edu',
      role: 'COORDINATOR',
      department: department._id,
    });
    faculty = await createUserWithRole({
      email: 'faculty@college.edu',
      role: 'FACULTY',
      department: department._id,
    });
  });

  async function createEventWithStatus(status) {
    const event = await Event.create({
      eventName: `Event ${status}`,
      description: 'A test event for analytics.',
      eventType: 'Workshop',
      department: department._id,
      eventDate: new Date(),
      organizer: faculty.user._id,
      createdBy: faculty.user._id,
      status,
    });
    return event;
  }

  it('returns zero counts when there are no events', async () => {
    const res = await request(app)
      .get('/api/analytics/events')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.approved).toBe(0);
  });

  it('counts events correctly by status', async () => {
    await createEventWithStatus('APPROVED');
    await createEventWithStatus('APPROVED');
    await createEventWithStatus('SUBMITTED');
    await createEventWithStatus('REJECTED');

    const res = await request(app)
      .get('/api/analytics/events')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(4);
    expect(res.body.data.approved).toBe(2);
    expect(res.body.data.pending).toBe(1);
    expect(res.body.data.rejected).toBe(1);
  });

  it('groups events by type', async () => {
    await Event.create({
      eventName: 'Conference A',
      description: 'A test event.',
      eventType: 'Conference',
      department: department._id,
      eventDate: new Date(),
      organizer: faculty.user._id,
      createdBy: faculty.user._id,
    });
    await Event.create({
      eventName: 'Workshop A',
      description: 'A test event.',
      eventType: 'Workshop',
      department: department._id,
      eventDate: new Date(),
      organizer: faculty.user._id,
      createdBy: faculty.user._id,
    });

    const res = await request(app)
      .get('/api/analytics/events')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.body.data.byType.Conference).toBe(1);
    expect(res.body.data.byType.Workshop).toBe(1);
  });

  it('excludes events outside the requested day range', async () => {
    const oldEvent = await createEventWithStatus('APPROVED');
    // Backdate it outside the default 30-day analytics window
    await Event.findByIdAndUpdate(oldEvent._id, {
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .get('/api/analytics/events?days=30')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.body.data.total).toBe(0);
  });
});

describe('Analytics newsletter stats', () => {
  let department, coordinator, dean, faculty;

  beforeEach(async () => {
    department = await Department.create({ name: 'Computer Science', code: 'CS' });
    coordinator = await createUserWithRole({
      email: 'coordinator@college.edu',
      role: 'COORDINATOR',
      department: department._id,
    });
    faculty = await createUserWithRole({
      email: 'faculty@college.edu',
      role: 'FACULTY',
      department: department._id,
    });

    await NewsletterTemplate.create({
      name: 'Default',
      structure: { blocks: [] },
      createdBy: new mongoose.Types.ObjectId(),
    });
  });

  it('returns zero stats when there are no newsletters', async () => {
    const res = await request(app)
      .get('/api/analytics/newsletters')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.avgOpenRate).toBe(0);
  });

  it('reflects real delivery stats after publishing, not hardcoded numbers', async () => {
    await Event.create({
      eventName: 'AI Workshop',
      description: 'A test event.',
      eventType: 'Workshop',
      department: department._id,
      eventDate: new Date(),
      organizer: faculty.user._id,
      createdBy: faculty.user._id,
      status: 'APPROVED',
    });

    const genRes = await request(app)
      .post('/api/newsletters/generate')
      .set('Authorization', `Bearer ${dean.token}`)
      .send({ startDate: '2020-01-01', endDate: '2030-01-01' });

    await request(app)
      .post(`/api/newsletters/${genRes.body.data._id}/publish`)
      .set('Authorization', `Bearer ${dean.token}`);

    const res = await request(app)
      .get('/api/analytics/newsletters')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.published).toBe(1);
  });
});

describe('Analytics user activity', () => {
  let department, coordinator;

  beforeEach(async () => {
    department = await Department.create({ name: 'Computer Science', code: 'CS' });
    coordinator = await createUserWithRole({
      email: 'coordinator@college.edu',
      role: 'COORDINATOR',
      department: department._id,
    });
  });

  it('returns a daily activity array spanning the requested range', async () => {
    const res = await request(app)
      .get('/api/analytics/users?days=7')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Should have one entry per day in the range (inclusive), i.e. 8 entries for a 7-day lookback
    expect(res.body.data.length).toBeGreaterThanOrEqual(7);
    expect(res.body.data[0]).toHaveProperty('events');
    expect(res.body.data[0]).toHaveProperty('newsletters');
    expect(res.body.data[0]).toHaveProperty('users');
  });
});