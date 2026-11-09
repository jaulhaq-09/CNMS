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

const validReportPayload = {
  name: 'Monthly Events Report',
  type: 'EVENTS',
  format: 'CSV',
};

describe('Report CRUD', () => {
  let owner, otherUser;

  beforeEach(async () => {
    owner = await createUserWithRole({ email: 'owner@college.edu', role: 'COORDINATOR' });
    otherUser = await createUserWithRole({ email: 'other@college.edu', role: 'COORDINATOR' });
  });

  it('creates a report owned by the requesting user', async () => {
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.owner).toBe(owner.user._id.toString());
    expect(res.body.data.format).toBe('CSV');
  });

  it('defaults format to PDF when not specified', async () => {
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Default Format Report', type: 'EVENTS' });

    expect(res.body.data.format).toBe('PDF');
  });

  it('rejects creating a report without a name or type', async () => {
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Missing Type' });

    expect(res.status).toBe(400);
  });

  it('only lists reports owned by the requesting user', async () => {
    await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);
    await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send(validReportPayload);

    const res = await request(app)
      .get('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('allows the owner to view their report', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);

    const res = await request(app)
      .get(`/api/reports/${created.body.data._id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
  });

  it('rejects a non-owner viewing a report with 403', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);

    const res = await request(app)
      .get(`/api/reports/${created.body.data._id}`)
      .set('Authorization', `Bearer ${otherUser.token}`);

    expect(res.status).toBe(403);
  });

  it('allows the owner to update their report', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);

    const res = await request(app)
      .put(`/api/reports/${created.body.data._id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Updated Report Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Report Name');
  });

  // NOTE: unlike GET, the update route does not pre-check ownership itself —
  // it relies on ReportService.updateReport() throwing a plain Error, which
  // the route's catch-all turns into 400, not 403. Documenting actual
  // behavior, not idealized behavior.
  it('rejects a non-owner updating a report with 400 (not 403)', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);

    const res = await request(app)
      .put(`/api/reports/${created.body.data._id}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(400);
  });

  it('allows the owner to delete their report', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);

    const res = await request(app)
      .delete(`/api/reports/${created.body.data._id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
  });

  it('rejects a non-owner deleting a report with 400 (not 403)', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);

    const res = await request(app)
      .delete(`/api/reports/${created.body.data._id}`)
      .set('Authorization', `Bearer ${otherUser.token}`);

    expect(res.status).toBe(400);
  });
});

describe('Report generation', () => {
  let owner;

  beforeEach(async () => {
    owner = await createUserWithRole({ email: 'owner@college.edu', role: 'COORDINATOR' });
  });

  it('generates a CSV for an EVENTS report', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);

    const res = await request(app)
      .post(`/api/reports/${created.body.data._id}/generate`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('rejects generating an unsupported report type', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Templates Report', type: 'TEMPLATES' });

    const res = await request(app)
      .post(`/api/reports/${created.body.data._id}/generate`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(400);
  });

  it('records generation history after a successful generate', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);

    await request(app)
      .post(`/api/reports/${created.body.data._id}/generate`)
      .set('Authorization', `Bearer ${owner.token}`);

    const res = await request(app)
      .get(`/api/reports/${created.body.data._id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.body.data.generationHistory.length).toBe(1);
    expect(res.body.data.generationHistory[0].status).toBe('SUCCESS');
    expect(res.body.data.lastGenerated.fileName).toBeDefined();
  });
});

describe('Report scheduling', () => {
  let owner, otherUser;

  beforeEach(async () => {
    owner = await createUserWithRole({ email: 'owner@college.edu', role: 'COORDINATOR' });
    otherUser = await createUserWithRole({ email: 'other@college.edu', role: 'COORDINATOR' });
  });

  it('schedules a report with the given frequency and time', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);

    const res = await request(app)
      .post(`/api/reports/${created.body.data._id}/schedule`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ frequency: 'WEEKLY', dayOfWeek: 1, time: '09:00' });

    expect(res.status).toBe(200);
    expect(res.body.data.scheduling.enabled).toBe(true);
    expect(res.body.data.scheduling.frequency).toBe('WEEKLY');
  });

  it('rejects a non-owner scheduling a report with 403', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);

    const res = await request(app)
      .post(`/api/reports/${created.body.data._id}/schedule`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({ frequency: 'WEEKLY', dayOfWeek: 1, time: '09:00' });

    expect(res.status).toBe(403);
  });

  it('unschedules a previously scheduled report', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validReportPayload);

    await request(app)
      .post(`/api/reports/${created.body.data._id}/schedule`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ frequency: 'WEEKLY', dayOfWeek: 1, time: '09:00' });

    const res = await request(app)
      .post(`/api/reports/${created.body.data._id}/unschedule`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.scheduling.enabled).toBe(false);
  });
});