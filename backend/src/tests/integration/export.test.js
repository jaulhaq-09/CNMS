require('dotenv').config();
const request = require('supertest');

jest.mock('../../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendPasswordChangedEmail: jest.fn().mockResolvedValue(true),
  sendTwoFactorEnabledEmail: jest.fn().mockResolvedValue(true),
  sendSuspiciousLoginAlert: jest.fn().mockResolvedValue(true),
}));

const app = require('../../app');
const User = require('../../models/User');
const Department = require('../../models/Department');
const Event = require('../../models/Event');
const Newsletter = require('../../models/Newsletter');
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

async function createUserWithRole({ email, role }) {
  const user = new User({
    email,
    password: 'SecurePass123',
    firstName: 'Test',
    lastName: role,
    role,
    emailVerified: true,
  });
  await user.save();

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'SecurePass123' });

  return { user, token: loginRes.body.data.token };
}

describe('Export events', () => {
  let department, coordinator;

  beforeEach(async () => {
    department = await Department.create({ name: 'Computer Science', code: 'CS' });
    coordinator = await createUserWithRole({ email: 'coord@college.edu', role: 'COORDINATOR' });

    await Event.create({
      eventName: 'AI Symposium',
      description: 'A symposium on artificial intelligence.',
      eventType: 'Conference',
      department: department._id,
      eventDate: new Date('2026-09-01'),
      organizer: coordinator.user._id,
      createdBy: coordinator.user._id,
      status: 'APPROVED',
    });
  });

  it('rejects an unauthenticated export request', async () => {
    const res = await request(app).get('/api/export/events');
    expect(res.status).toBe(401);
  });

  it('exports events as CSV by default', async () => {
    const res = await request(app)
      .get('/api/export/events')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('AI Symposium');
  });

  it('exports events as CSV explicitly with the right headers', async () => {
    const res = await request(app)
      .get('/api/export/events?format=CSV')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Event Name');
    expect(res.text).toContain('Status');
  });

  it('exports events as Excel with correct content-type and non-empty body', async () => {
    const res = await request(app)
      .get('/api/export/events?format=EXCEL')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('exports events as PDF with correct content-type and non-empty body', async () => {
    const res = await request(app)
      .get('/api/export/events?format=PDF')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('filters exported events by status', async () => {
    await Event.create({
      eventName: 'Rejected Workshop',
      description: 'This one was rejected.',
      eventType: 'Workshop',
      department: department._id,
      eventDate: new Date(),
      organizer: coordinator.user._id,
      createdBy: coordinator.user._id,
      status: 'REJECTED',
    });

    const res = await request(app)
      .get('/api/export/events?format=CSV&status=APPROVED')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.text).toContain('AI Symposium');
    expect(res.text).not.toContain('Rejected Workshop');
  });

  it('returns a valid empty CSV when there is nothing to export', async () => {
    await Event.deleteMany({});

    const res = await request(app)
      .get('/api/export/events?format=CSV')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
  });
});

describe('Export newsletters', () => {
  let coordinator;

  beforeEach(async () => {
    coordinator = await createUserWithRole({ email: 'coord@college.edu', role: 'COORDINATOR' });

    await Newsletter.create({
      name: 'September Digest',
      compiledHtml: '<p>content</p>',
      periodStartDate: new Date('2026-09-01'),
      periodEndDate: new Date('2026-09-30'),
      status: 'PUBLISHED',
      createdBy: coordinator.user._id,
      deliveryStats: { totalSent: 50, delivered: 48, opened: 20, clicked: 5 },
    });
  });

  it('exports newsletters as CSV with real delivery stats, not placeholders', async () => {
    const res = await request(app)
      .get('/api/export/newsletters?format=CSV')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('September Digest');
    expect(res.text).toContain('50');
    expect(res.text).toContain('48');
  });

  it('filters exported newsletters by status', async () => {
    await Newsletter.create({
      name: 'Draft Newsletter',
      compiledHtml: '<p>draft</p>',
      periodStartDate: new Date(),
      periodEndDate: new Date(),
      status: 'DRAFT',
      createdBy: coordinator.user._id,
    });

    const res = await request(app)
      .get('/api/export/newsletters?format=CSV&status=PUBLISHED')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.text).toContain('September Digest');
    expect(res.text).not.toContain('Draft Newsletter');
  });
});