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

describe('Department admin', () => {
  let superAdmin, coordinator;

  beforeEach(async () => {
    superAdmin = await createUserWithRole({ email: 'admin@college.edu', role: 'SUPER_ADMIN' });
    coordinator = await createUserWithRole({ email: 'coord@college.edu', role: 'COORDINATOR' });
  });

  it('allows SUPER_ADMIN to create a department', async () => {
    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ name: 'Computer Science', code: 'CS' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Computer Science');
    expect(res.body.data.isActive).toBe(true);
  });

  it('rejects a non-SUPER_ADMIN creating a department', async () => {
    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({ name: 'Computer Science', code: 'CS' });

    expect(res.status).toBe(403);
  });

  it('rejects a duplicate department name/code', async () => {
    await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ name: 'Computer Science', code: 'CS' });

    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ name: 'Computer Science', code: 'CS2' });

    expect(res.status).toBe(400);
  });

  it('lists only active departments by default', async () => {
    const dept = await Department.create({ name: 'Mathematics', code: 'MATH' });
    await request(app)
      .delete(`/api/departments/${dept._id}`)
      .set('Authorization', `Bearer ${superAdmin.token}`);

    const res = await request(app)
      .get('/api/departments')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.find((d) => d._id === dept._id.toString())).toBeUndefined();
  });

  it('soft-deletes a department (deactivate, not remove)', async () => {
    const dept = await Department.create({ name: 'Physics', code: 'PHY' });

    const res = await request(app)
      .delete(`/api/departments/${dept._id}`)
      .set('Authorization', `Bearer ${superAdmin.token}`);

    expect(res.status).toBe(200);

    const stillExists = await Department.findById(dept._id);
    expect(stillExists).not.toBeNull();
    expect(stillExists.isActive).toBe(false);
  });

  it('updates a department', async () => {
    const dept = await Department.create({ name: 'Biology', code: 'BIO' });

    const res = await request(app)
      .put(`/api/departments/${dept._id}`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ description: 'Life sciences department' });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('Life sciences department');
  });
});

describe('User admin', () => {
  let superAdmin, coordinator, department;

  beforeEach(async () => {
    superAdmin = await createUserWithRole({ email: 'admin@college.edu', role: 'SUPER_ADMIN' });
    coordinator = await createUserWithRole({ email: 'coord@college.edu', role: 'COORDINATOR' });
    department = await Department.create({ name: 'Computer Science', code: 'CS' });
  });

  it('allows SUPER_ADMIN to create a user with a role and scope', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({
        email: 'newfaculty@college.edu',
        password: 'SecurePass123',
        firstName: 'New',
        lastName: 'Faculty',
        role: 'FACULTY',
        department: department._id,
        clusters: ['AI'],
        sections: ['A'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('FACULTY');
    expect(res.body.data.clusters).toEqual(['AI']);
    // Password must never be echoed back
    expect(res.body.data.password).toBeUndefined();
  });

  it('rejects a non-SUPER_ADMIN creating a user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        email: 'newfaculty@college.edu',
        password: 'SecurePass123',
        firstName: 'New',
        lastName: 'Faculty',
        role: 'FACULTY',
      });

    expect(res.status).toBe(403);
  });

  it('rejects creating a user with an already-registered email', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({
        email: 'coord@college.edu',
        password: 'SecurePass123',
        firstName: 'Dup',
        lastName: 'User',
        role: 'FACULTY',
      });

    expect(res.status).toBe(409);
  });

  it('allows SUPER_ADMIN to update a user role and scope', async () => {
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({
        email: 'promote@college.edu',
        password: 'SecurePass123',
        firstName: 'Future',
        lastName: 'Coordinator',
        role: 'FACULTY',
        department: department._id,
      });

    const userId = created.body.data._id;

    const res = await request(app)
      .put(`/api/users/${userId}/access`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ role: 'COORDINATOR', clusters: ['AI'] });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('COORDINATOR');
    expect(res.body.data.clusters).toEqual(['AI']);
  });

  it('allows SUPER_ADMIN to deactivate a user', async () => {
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({
        email: 'deactivate@college.edu',
        password: 'SecurePass123',
        firstName: 'Leaving',
        lastName: 'User',
        role: 'FACULTY',
      });

    const userId = created.body.data._id;

    const res = await request(app)
      .put(`/api/users/${userId}/access`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('paginates and searches the user list', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${superAdmin.token}`)
        .send({
          email: `searchable${i}@college.edu`,
          password: 'SecurePass123',
          firstName: 'Searchable',
          lastName: `User${i}`,
          role: 'FACULTY',
        });
    }

    const res = await request(app)
      .get('/api/users?search=Searchable&limit=2&page=1')
      .set('Authorization', `Bearer ${superAdmin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.total).toBe(3);
  });
});