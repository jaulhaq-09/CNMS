require('dotenv').config();
const request = require('supertest');

const app = require('../../app');
const User = require('../../models/User');
const Settings = require('../../models/Settings');
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

describe('Settings', () => {
  let superAdmin, coordinator;

  beforeEach(async () => {
    superAdmin = await createUserWithRole({ email: 'admin@college.edu', role: 'SUPER_ADMIN' });
    coordinator = await createUserWithRole({ email: 'coord@college.edu', role: 'COORDINATOR' });
  });

  it('auto-creates a default settings document on first GET', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.instituteName).toBe('BMSITM');
    expect(res.body.data.currentVolume).toBe(1);
    expect(res.body.data.currentIssue).toBe(1);

    const stored = await Settings.findOne();
    expect(stored).not.toBeNull();
  });

  it('rejects an unauthenticated GET', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });

  it('allows any authenticated user to read settings, not just SUPER_ADMIN', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.status).toBe(200);
  });

  it('allows SUPER_ADMIN to update settings', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ instituteName: 'BMSIT&M', currentVolume: 12, currentIssue: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.instituteName).toBe('BMSIT&M');
    expect(res.body.data.currentVolume).toBe(12);
  });

  it('rejects a non-SUPER_ADMIN updating settings', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({ instituteName: 'Hijacked Name' });

    expect(res.status).toBe(403);
  });

  it('saves editorial board members as an array', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({
        editorialBoard: [
          { name: 'Dr. Ambika R', role: "Dean, Students' Welfare" },
          { name: 'Dr. Surekha R Gondkar', role: 'Assoc. Prof., Dept. of ECE' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.editorialBoard.length).toBe(2);
    expect(res.body.data.editorialBoard[0].name).toBe('Dr. Ambika R');
  });

  it('saves nested social links', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ socialLinks: { twitter: 'https://twitter.com/bmsitm1' } });

    expect(res.status).toBe(200);
    expect(res.body.data.socialLinks.twitter).toBe('https://twitter.com/bmsitm1');
  });

  it('persists updates across subsequent GET requests', async () => {
    await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ principalName: 'Dr. Sanjay H A' });

    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(res.body.data.principalName).toBe('Dr. Sanjay H A');
  });
});