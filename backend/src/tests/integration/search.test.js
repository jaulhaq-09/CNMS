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

describe('Search', () => {
  let department, coordinator;

  beforeEach(async () => {
    department = await Department.create({ name: 'Computer Science', code: 'CS' });
    coordinator = await createUserWithRole({ email: 'coord@college.edu', role: 'COORDINATOR' });

    await Event.create({
      eventName: 'Robotics Symposium',
      description: 'A gathering focused on autonomous robotics research.',
      eventType: 'Conference',
      department: department._id,
      eventDate: new Date(),
      organizer: coordinator.user._id,
      createdBy: coordinator.user._id,
      status: 'APPROVED',
    });

    await Event.create({
      eventName: 'Cooking Basics',
      description: 'An introductory cooking workshop for beginners.',
      eventType: 'Workshop',
      department: department._id,
      eventDate: new Date(),
      organizer: coordinator.user._id,
      createdBy: coordinator.user._id,
      status: 'APPROVED',
    });

    await Newsletter.create({
      name: 'Robotics Roundup',
      description: 'Monthly robotics club news.',
      compiledHtml: '<p>content</p>',
      periodStartDate: new Date(),
      periodEndDate: new Date(),
      createdBy: coordinator.user._id,
    });

    await NewsletterTemplate.create({
      name: 'Robotics Newsletter Template',
      description: 'A reusable template for robotics-themed newsletters.',
      structure: { blocks: [] },
      createdBy: coordinator.user._id,
    });
  });

  it('rejects a query shorter than 2 characters', async () => {
    const res = await request(app)
      .get('/api/search?q=r')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated global search', async () => {
    const res = await request(app).get('/api/search?q=robotics');
    expect(res.status).toBe(401);
  });

  it('finds matches across events, newsletters, and templates in one global search', async () => {
    const res = await request(app)
      .get('/api/search?q=robotics')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.counts.events).toBe(1);
    expect(res.body.counts.newsletters).toBe(1);
    expect(res.body.counts.templates).toBe(1);
    expect(res.body.counts.total).toBe(3);
  });

  it('does not match unrelated content', async () => {
    const res = await request(app)
      .get('/api/search?q=cooking')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.body.counts.events).toBe(1);
    expect(res.body.counts.newsletters).toBe(0);
    expect(res.body.counts.templates).toBe(0);
  });

  it('searches events only via the scoped endpoint', async () => {
    const res = await request(app)
      .get('/api/search/events?q=robotics')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].eventName).toBe('Robotics Symposium');
  });

  it('searches newsletters only via the scoped endpoint (regression: missing text index)', async () => {
    const res = await request(app)
      .get('/api/search/newsletters?q=robotics')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Robotics Roundup');
  });

  it('searches templates only via the scoped endpoint (regression: missing text index)', async () => {
    const res = await request(app)
      .get('/api/search/templates?q=robotics')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Robotics Newsletter Template');
  });

  it('filters event search by eventType', async () => {
    const res = await request(app)
      .get('/api/search/events?q=robotics&eventType=Conference')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.body.data.length).toBe(1);

    const noMatch = await request(app)
      .get('/api/search/events?q=robotics&eventType=Workshop')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(noMatch.body.data.length).toBe(0);
  });

  it('returns empty suggestion arrays for a query under 2 characters, without erroring', async () => {
    const res = await request(app)
      .get('/api/search/suggestions?q=r')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.events).toEqual([]);
  });

  it('returns suggestions across all content types', async () => {
    const res = await request(app)
      .get('/api/search/suggestions?q=robotics')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.events.length).toBe(1);
    expect(res.body.data.newsletters.length).toBe(1);
    expect(res.body.data.templates.length).toBe(1);
  });
});