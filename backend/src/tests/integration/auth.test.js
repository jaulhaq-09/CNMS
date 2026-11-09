require('dotenv').config();
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// EmailService is mocked so tests never hit a real mail provider — the
// project's .env now has real Gmail credentials, so leaving this unmocked
// would actually send emails on every test run.
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

const validUser = {
  email: 'jane.faculty@college.edu',
  password: 'SecurePass123',
  firstName: 'Jane',
  lastName: 'Faculty',
};

describe('POST /api/auth/register', () => {
  it('registers a new user and returns a token + refreshToken', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(validUser.email.toLowerCase());
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    // Password must never be echoed back
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  // Regression test: authService previously called bcrypt.hash() manually
  // AND the User model's pre('save') hook also hashed it, silently
  // double-hashing every password and breaking login for everyone.
  it('stores the password hashed exactly once (not double-hashed)', async () => {
    await request(app).post('/api/auth/register').send(validUser);

    const stored = await User.findOne({ email: validUser.email.toLowerCase() }).select('+password');
    const matches = await bcrypt.compare(validUser.password, stored.password);

    expect(matches).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validUser);
  });

  it('logs in with correct credentials and returns a valid token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  // Regression test: the JWT payload key is `userId`, not `id`. Code that
  // reads decoded.id (instead of decoded.userId) silently gets undefined
  // and breaks every downstream lookup.
  it('issues a token whose payload uses the "userId" key', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET);

    expect(decoded.userId).toBeDefined();
    expect(decoded.id).toBeUndefined();
    expect(decoded.role).toBe('GUEST');
  });

  it('rejects an incorrect password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'WrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects a login for a non-existent email with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@college.edu', password: 'whatever123' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user when authenticated', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    const token = loginRes.body.data.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(validUser.email.toLowerCase());
  });

  it('rejects the request with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});