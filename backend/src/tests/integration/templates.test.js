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

const validTemplatePayload = {
  name: 'Weekly Digest',
  description: 'A standard weekly template',
  structure: { blocks: [{ type: 'header' }] },
  category: 'weekly',
  tags: ['digest'],
};

describe('Template CRUD', () => {
  let coordinator, superAdmin, otherCoordinator;

  beforeEach(async () => {
    coordinator = await createUserWithRole({ email: 'coord@college.edu', role: 'COORDINATOR' });
    otherCoordinator = await createUserWithRole({ email: 'other@college.edu', role: 'COORDINATOR' });
    superAdmin = await createUserWithRole({ email: 'admin@college.edu', role: 'SUPER_ADMIN' });
  });

  it('creates a template as DRAFT by default', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send(validTemplatePayload);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.name).toBe('Weekly Digest');
  });

  it('rejects creating a template without a structure', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({ name: 'Missing Structure' });

    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated create request', async () => {
    const res = await request(app).post('/api/templates').send(validTemplatePayload);
    expect(res.status).toBe(401);
  });

  it('lists templates with pagination', async () => {
    await NewsletterTemplate.create({ ...validTemplatePayload, createdBy: coordinator.user._id });
    await NewsletterTemplate.create({
      ...validTemplatePayload,
      name: 'Monthly Digest',
      createdBy: coordinator.user._id,
    });

    const res = await request(app)
      .get('/api/templates')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.totalCount).toBe(2);
  });

  it('gets a single template by id', async () => {
    const template = await NewsletterTemplate.create({
      ...validTemplatePayload,
      createdBy: coordinator.user._id,
    });

    const res = await request(app)
      .get(`/api/templates/${template._id}`)
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Weekly Digest');
  });

  it('allows the owner to update their own template', async () => {
    const template = await NewsletterTemplate.create({
      ...validTemplatePayload,
      createdBy: coordinator.user._id,
    });

    const res = await request(app)
      .put(`/api/templates/${template._id}`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('bumps the version and archives the previous structure on update', async () => {
    const template = await NewsletterTemplate.create({
      ...validTemplatePayload,
      createdBy: coordinator.user._id,
    });

    const res = await request(app)
      .put(`/api/templates/${template._id}`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({ structure: { blocks: [{ type: 'footer' }] } });

    expect(res.body.data.version).toBe(2);
    expect(res.body.data.previousVersions.length).toBe(1);
  });

  it('rejects a non-owner, non-admin from updating a template', async () => {
    const template = await NewsletterTemplate.create({
      ...validTemplatePayload,
      createdBy: coordinator.user._id,
    });

    const res = await request(app)
      .put(`/api/templates/${template._id}`)
      .set('Authorization', `Bearer ${otherCoordinator.token}`)
      .send({ name: 'Hijacked Name' });

    expect(res.status).toBe(403);
  });

  it('allows SUPER_ADMIN to update any template', async () => {
    const template = await NewsletterTemplate.create({
      ...validTemplatePayload,
      createdBy: coordinator.user._id,
    });

    const res = await request(app)
      .put(`/api/templates/${template._id}`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ name: 'Admin Renamed' });

    expect(res.status).toBe(200);
  });

  it('rejects a non-owner from deleting a template', async () => {
    const template = await NewsletterTemplate.create({
      ...validTemplatePayload,
      createdBy: coordinator.user._id,
    });

    const res = await request(app)
      .delete(`/api/templates/${template._id}`)
      .set('Authorization', `Bearer ${otherCoordinator.token}`);

    expect(res.status).toBe(403);
  });

  it('allows the owner to delete their own template', async () => {
    const template = await NewsletterTemplate.create({
      ...validTemplatePayload,
      createdBy: coordinator.user._id,
    });

    const res = await request(app)
      .delete(`/api/templates/${template._id}`)
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);

    const stillExists = await NewsletterTemplate.findById(template._id);
    expect(stillExists).toBeNull();
  });

  it('duplicates a template with a "(Copy)" suffix and resets to DRAFT', async () => {
    const template = await NewsletterTemplate.create({
      ...validTemplatePayload,
      status: 'ACTIVE',
      createdBy: coordinator.user._id,
    });

    const res = await request(app)
      .post(`/api/templates/${template._id}/duplicate`)
      .set('Authorization', `Bearer ${otherCoordinator.token}`);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Weekly Digest (Copy)');
    expect(res.body.data.status).toBe('DRAFT');
  });

  it('rejects a non-SUPER_ADMIN from publishing a template', async () => {
    const template = await NewsletterTemplate.create({
      ...validTemplatePayload,
      createdBy: coordinator.user._id,
    });

    const res = await request(app)
      .post(`/api/templates/${template._id}/publish`)
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(403);
  });

  it('allows SUPER_ADMIN to publish a template, setting status to ACTIVE', async () => {
    const template = await NewsletterTemplate.create({
      ...validTemplatePayload,
      createdBy: coordinator.user._id,
    });

    const res = await request(app)
      .post(`/api/templates/${template._id}/publish`)
      .set('Authorization', `Bearer ${superAdmin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('returns only ACTIVE + public templates from the public endpoint, with no auth required', async () => {
    await NewsletterTemplate.create({
      ...validTemplatePayload,
      status: 'ACTIVE',
      isPublic: true,
      createdBy: coordinator.user._id,
    });
    await NewsletterTemplate.create({
      ...validTemplatePayload,
      name: 'Private Draft',
      status: 'DRAFT',
      isPublic: false,
      createdBy: coordinator.user._id,
    });

    const res = await request(app).get('/api/templates/public');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Weekly Digest');
  });
});