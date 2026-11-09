require('dotenv').config();
const request = require('supertest');

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

const validPayload = {
  title: 'AI-Enabled Automatic Trolley',
  inventors: ['Dr. Shivakumara T'],
  grantingAuthority: 'Intellectual Property Office of India',
  grantStatus: 'GRANTED',
  grantDate: '2026-01-10',
};

describe('Patent CRUD', () => {
  let department, faculty, otherFaculty, coordinator;

  beforeEach(async () => {
    department = await Department.create({ name: 'MCA', code: 'MCA' });
    faculty = await createUserWithRole({
      email: 'faculty@college.edu',
      role: 'FACULTY',
      department: department._id,
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
    });
  });

  it('creates a patent as DRAFT', async () => {
    const res = await request(app)
      .post('/api/patents')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.grantStatus).toBe('GRANTED');
  });

  it('rejects a patent with no inventors', async () => {
    const res = await request(app)
      .post('/api/patents')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({ ...validPayload, inventors: [] });

    expect(res.status).toBe(400);
  });

  it('rejects a patent missing the granting authority', async () => {
    const { grantingAuthority, ...payloadWithoutAuthority } = validPayload;
    const res = await request(app)
      .post('/api/patents')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(payloadWithoutAuthority);

    expect(res.status).toBe(400);
  });

  it('allows an APPLIED patent with no grant date', async () => {
    const res = await request(app)
      .post('/api/patents')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({
        title: 'Pending Patent',
        inventors: ['Dr. Someone'],
        grantingAuthority: 'Intellectual Property Office of India',
        grantStatus: 'APPLIED',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.grantStatus).toBe('APPLIED');
  });

  it('lists patents with pagination', async () => {
    await request(app)
      .post('/api/patents')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);

    const res = await request(app)
      .get('/api/patents')
      .set('Authorization', `Bearer ${faculty.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('allows the owner to update a DRAFT patent', async () => {
    const created = await request(app)
      .post('/api/patents')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);

    const res = await request(app)
      .put(`/api/patents/${created.body.data._id}`)
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({ title: 'Updated Patent Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Patent Title');
  });

  it('rejects a non-owner updating a patent', async () => {
    const created = await request(app)
      .post('/api/patents')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);

    const res = await request(app)
      .put(`/api/patents/${created.body.data._id}`)
      .set('Authorization', `Bearer ${otherFaculty.token}`)
      .send({ title: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('allows the owner to delete their own patent', async () => {
    const created = await request(app)
      .post('/api/patents')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);

    const res = await request(app)
      .delete(`/api/patents/${created.body.data._id}`)
      .set('Authorization', `Bearer ${faculty.token}`);

    expect(res.status).toBe(200);
  });
});

describe('Patent approval workflow', () => {
  let department, faculty, coordinator;

  beforeEach(async () => {
    department = await Department.create({ name: 'MCA', code: 'MCA' });
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

  it('takes a patent through submit -> approve', async () => {
    const created = await request(app)
      .post('/api/patents')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);
    const id = created.body.data._id;

    const submitRes = await request(app)
      .post(`/api/patents/${id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('SUBMITTED');

    const approveRes = await request(app)
      .post(`/api/patents/${id}/approve`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({});

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');
  });

  it('requires feedback to reject a patent', async () => {
    const created = await request(app)
      .post('/api/patents')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);
    const id = created.body.data._id;

    await request(app)
      .post(`/api/patents/${id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    const res = await request(app)
      .post(`/api/patents/${id}/reject`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('rejects FACULTY approving a patent (not authorized)', async () => {
    const created = await request(app)
      .post('/api/patents')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);
    const id = created.body.data._id;

    await request(app)
      .post(`/api/patents/${id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    const res = await request(app)
      .post(`/api/patents/${id}/approve`)
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({});

    expect(res.status).toBe(403);
  });
});