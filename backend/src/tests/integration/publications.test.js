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
  sendPublicationApprovedEmail: jest.fn().mockResolvedValue(true),
  sendPublicationRejectedEmail: jest.fn().mockResolvedValue(true),
  sendNewsletterEmail: jest.fn().mockResolvedValue(true),
  sendNewsletterToRecipients: jest.fn().mockResolvedValue({ totalSent: 0, delivered: 0, bounced: 0 }),
}));

const app = require('../../app');
const User = require('../../models/User');
const Department = require('../../models/Department');
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

const validPublicationPayload = {
  title: 'A Study on Deep Learning',
  authors: ['Dr. Jane Faculty', 'Dr. John Coauthor'],
  publicationType: 'JOURNAL',
  venueName: 'IEEE Transactions on AI',
  doi: 'https://doi.org/10.1000/example',
  indexing: ['Scopus', 'SCI'],
};

describe('Publication CRUD', () => {
  let department, faculty, otherFaculty, coordinator;

  beforeEach(async () => {
    department = await Department.create({ name: 'Computer Science', code: 'CS' });
    faculty = await createUserWithRole({
      email: 'faculty@college.edu',
      role: 'FACULTY',
      department: department._id,
      clusters: ['AI'],
    });
    otherFaculty = await createUserWithRole({
      email: 'other@college.edu',
      role: 'FACULTY',
      department: department._id,
    });
    coordinator = await createUserWithRole({
      email: 'coord@college.edu',
      role: 'COORDINATOR',
      department: department._id,
      clusters: ['AI'],
    });
  });

  it('creates a publication as DRAFT, defaulting department to the creator\'s own', async () => {
    const res = await request(app)
      .post('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPublicationPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.department._id).toBe(department._id.toString());
  });

  it('rejects a publication with no authors', async () => {
    const res = await request(app)
      .post('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({ ...validPublicationPayload, authors: [] });

    expect(res.status).toBe(400);
  });

  it('rejects FACULTY posting into a cluster they are not assigned to', async () => {
    const res = await request(app)
      .post('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({ ...validPublicationPayload, cluster: 'Robotics' });

    expect(res.status).toBe(403);
  });

  it('lists publications with pagination', async () => {
    await request(app)
      .post('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPublicationPayload);

    const res = await request(app)
      .get('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.pagination.totalCount).toBe(1);
  });

  it('allows the owner to update a DRAFT publication', async () => {
    const created = await request(app)
      .post('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPublicationPayload);

    const res = await request(app)
      .put(`/api/publications/${created.body.data._id}`)
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
  });

  it('rejects a non-owner updating a publication', async () => {
    const created = await request(app)
      .post('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPublicationPayload);

    const res = await request(app)
      .put(`/api/publications/${created.body.data._id}`)
      .set('Authorization', `Bearer ${otherFaculty.token}`)
      .send({ title: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('allows the owner to delete their own publication', async () => {
    const created = await request(app)
      .post('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPublicationPayload);

    const res = await request(app)
      .delete(`/api/publications/${created.body.data._id}`)
      .set('Authorization', `Bearer ${faculty.token}`);

    expect(res.status).toBe(200);
  });
});

describe('Publication approval workflow', () => {
  let department, faculty, coordinator;

  beforeEach(async () => {
    department = await Department.create({ name: 'Computer Science', code: 'CS' });
    faculty = await createUserWithRole({
      email: 'faculty@college.edu',
      role: 'FACULTY',
      department: department._id,
    });
    coordinator = await createUserWithRole({
      email: 'coord@college.edu',
      role: 'COORDINATOR',
      department: department._id,
    });
  });

  it('takes a publication through submit -> approve', async () => {
    const created = await request(app)
      .post('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPublicationPayload);
    const id = created.body.data._id;

    const submitRes = await request(app)
      .post(`/api/publications/${id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('SUBMITTED');

    const approveRes = await request(app)
      .post(`/api/publications/${id}/approve`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({ feedback: 'Looks great.' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');
  });

  it('rejects submitting a publication that is not in DRAFT', async () => {
    const created = await request(app)
      .post('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPublicationPayload);
    const id = created.body.data._id;

    await request(app)
      .post(`/api/publications/${id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    const secondSubmit = await request(app)
      .post(`/api/publications/${id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    expect(secondSubmit.status).toBe(400);
  });

  it('requires feedback to reject a publication', async () => {
    const created = await request(app)
      .post('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPublicationPayload);
    const id = created.body.data._id;

    await request(app)
      .post(`/api/publications/${id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    const res = await request(app)
      .post(`/api/publications/${id}/reject`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('rejects a publication with feedback and reflects the final status', async () => {
    const created = await request(app)
      .post('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPublicationPayload);
    const id = created.body.data._id;

    await request(app)
      .post(`/api/publications/${id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    const res = await request(app)
      .post(`/api/publications/${id}/reject`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({ feedback: 'Please add DOI.' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
  });

  it('rejects FACULTY approving a publication (not authorized)', async () => {
    const created = await request(app)
      .post('/api/publications')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPublicationPayload);
    const id = created.body.data._id;

    await request(app)
      .post(`/api/publications/${id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    const res = await request(app)
      .post(`/api/publications/${id}/approve`)
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({});

    expect(res.status).toBe(403);
  });
});