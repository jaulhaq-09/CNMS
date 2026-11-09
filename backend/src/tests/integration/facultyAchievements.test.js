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
  title: 'AICTE QIP PG Certification in Machine Learning',
  category: 'CERTIFICATION',
  description: 'Completed a certification program at IISc, sponsored by AICTE.',
  awardingBody: 'AICTE',
  achievementDate: '2026-01-09',
};

describe('Faculty Achievement CRUD', () => {
  let department, faculty, otherFaculty, coordinator;

  beforeEach(async () => {
    department = await Department.create({ name: 'Civil Engineering', code: 'CIV' });
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

  it('creates an achievement as DRAFT', async () => {
    const res = await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.category).toBe('CERTIFICATION');
  });

  it('rejects an achievement without a required field (category)', async () => {
    const { category, ...payloadWithoutCategory } = validPayload;
    const res = await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(payloadWithoutCategory);

    expect(res.status).toBe(400);
  });

  it('stores an optional grant amount for GRANT category', async () => {
    const res = await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({ ...validPayload, category: 'GRANT', amount: 50000 });

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(50000);
  });

  it('lists achievements with pagination', async () => {
    await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);

    const res = await request(app)
      .get('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('filters achievements by category', async () => {
    await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);
    await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({ ...validPayload, category: 'AWARD', title: 'Best Paper Award' });

    const res = await request(app)
      .get('/api/faculty-achievements?category=AWARD')
      .set('Authorization', `Bearer ${faculty.token}`);

    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].category).toBe('AWARD');
  });

  it('allows the owner to update a DRAFT achievement', async () => {
    const created = await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);

    const res = await request(app)
      .put(`/api/faculty-achievements/${created.body.data._id}`)
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
  });

  it('rejects a non-owner updating an achievement', async () => {
    const created = await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);

    const res = await request(app)
      .put(`/api/faculty-achievements/${created.body.data._id}`)
      .set('Authorization', `Bearer ${otherFaculty.token}`)
      .send({ title: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('allows the owner to delete their own achievement', async () => {
    const created = await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);

    const res = await request(app)
      .delete(`/api/faculty-achievements/${created.body.data._id}`)
      .set('Authorization', `Bearer ${faculty.token}`);

    expect(res.status).toBe(200);
  });
});

describe('Faculty Achievement approval workflow', () => {
  let department, faculty, coordinator;

  beforeEach(async () => {
    department = await Department.create({ name: 'Civil Engineering', code: 'CIV' });
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

  it('takes an achievement through submit -> approve', async () => {
    const created = await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);
    const id = created.body.data._id;

    const submitRes = await request(app)
      .post(`/api/faculty-achievements/${id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('SUBMITTED');

    const approveRes = await request(app)
      .post(`/api/faculty-achievements/${id}/approve`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({});

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');
  });

  it('requires feedback to reject an achievement', async () => {
    const created = await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);
    const id = created.body.data._id;

    await request(app)
      .post(`/api/faculty-achievements/${id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    const res = await request(app)
      .post(`/api/faculty-achievements/${id}/reject`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('rejects FACULTY approving an achievement (not authorized)', async () => {
    const created = await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);
    const id = created.body.data._id;

    await request(app)
      .post(`/api/faculty-achievements/${id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    const res = await request(app)
      .post(`/api/faculty-achievements/${id}/approve`)
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('rejects approving an achievement that has not been submitted', async () => {
    const created = await request(app)
      .post('/api/faculty-achievements')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validPayload);
    const id = created.body.data._id;

    const res = await request(app)
      .post(`/api/faculty-achievements/${id}/approve`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});