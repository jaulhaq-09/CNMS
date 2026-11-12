require('dotenv').config();
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendPasswordChangedEmail: jest.fn().mockResolvedValue(true),
  sendTwoFactorEnabledEmail: jest.fn().mockResolvedValue(true),
  sendSuspiciousLoginAlert: jest.fn().mockResolvedValue(true),
  sendEventApprovedEmail: jest.fn().mockResolvedValue(true),
  sendEventRejectedEmail: jest.fn().mockResolvedValue(true),
  sendApprovalRequestEmail: jest.fn().mockResolvedValue(true),
  sendNewsletterEmail: jest.fn().mockResolvedValue(true),
  sendNewsletterToRecipients: jest.fn().mockResolvedValue({ totalSent: 0, delivered: 0, bounced: 0 }),
}));

const app = require('../../app');
const User = require('../../models/User');
const Department = require('../../models/Department');
const { findApprovers } = require('../../services/approvalNotifier');
const EmailService = require('../../services/emailService');
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

// Registers + logs in a user with a given role/scope directly against the
// User model (bypassing the public register endpoint, which always
// defaults role to GUEST) — mirrors how an admin actually assigns access
// via the User Management page.
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

describe('Event lifecycle', () => {
  let department, faculty, coordinator;

  beforeEach(async () => {
    department = await Department.create({ name: 'Computer Science', code: 'CS' });

    faculty = await createUserWithRole({
      email: 'faculty@college.edu',
      role: 'FACULTY',
      department: department._id,
      clusters: ['AI'],
      sections: ['A'],
    });

    coordinator = await createUserWithRole({
      email: 'coordinator@college.edu',
      role: 'COORDINATOR',
      department: department._id,
      clusters: ['AI'],
    });
  });

  const validEventPayload = {
    eventName: 'AI Workshop',
    description: 'A hands-on workshop on machine learning basics.',
    eventType: 'Workshop',
    cluster: 'AI',
    section: 'A',
    eventDate: '2026-09-01',
  };

  it('allows FACULTY to create an event within their assigned cluster/section', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validEventPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.department._id).toBe(department._id.toString());
  });

  // Regression test for the scope-forging fix described in project notes:
  // FACULTY must not be able to post into a cluster/section they aren't
  // actually assigned to, even if they put a different value in the body.
  it('rejects FACULTY posting into a cluster they are not assigned to', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({ ...validEventPayload, cluster: 'Robotics' });

    expect(res.status).toBe(403);
  });

  it('rejects FACULTY posting into a section they are not assigned to', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({ ...validEventPayload, section: 'Z' });

    expect(res.status).toBe(403);
  });

  it('takes an event through submit -> approve and reflects the final status', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validEventPayload);

    const eventId = createRes.body.data._id;

    const submitRes = await request(app)
      .post(`/api/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('SUBMITTED');

    const approveRes = await request(app)
      .post(`/api/events/${eventId}/approve`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({ feedback: 'Looks good.' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');
  });

  it('emails the Coordinator on every submission and resubmission, and the submitter on every return', async () => {
    EmailService.sendApprovalRequestEmail.mockClear();
    EmailService.sendEventRejectedEmail.mockClear();

    const withAuth = (req, token) => req.set('Authorization', ['Bearer', token].join(' '));
    const createRes = await withAuth(request(app).post('/api/events'), faculty.token)
      .send(validEventPayload);
    const eventId = createRes.body.data._id;

    const submit = () =>
      withAuth(request(app).post(`/api/events/${eventId}/submit`), faculty.token);
    const reject = () =>
      withAuth(request(app).post(`/api/events/${eventId}/reject`), coordinator.token)
        .send({ feedback: 'Please revise this submission.' });

    expect((await submit()).status).toBe(200);
    expect((await reject()).status).toBe(200);
    expect((await submit()).status).toBe(200);
    expect((await reject()).status).toBe(200);
    expect((await submit()).status).toBe(200);

    expect(EmailService.sendApprovalRequestEmail).toHaveBeenCalledTimes(3);
    expect(EmailService.sendApprovalRequestEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ email: 'coordinator@college.edu' }),
      expect.objectContaining({ isResubmission: false })
    );
    expect(EmailService.sendApprovalRequestEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ email: 'coordinator@college.edu' }),
      expect.objectContaining({ isResubmission: true })
    );
    expect(EmailService.sendApprovalRequestEmail).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ email: 'coordinator@college.edu' }),
      expect.objectContaining({ isResubmission: true })
    );
    expect(EmailService.sendEventRejectedEmail).toHaveBeenCalledTimes(2);
  });

  it('uses a selected secondary Coordinator role for requests and token refresh', async () => {
    EmailService.sendApprovalRequestEmail.mockClear();
    const secondaryCoordinator = await User.create({
      email: 'jaul@college.edu',
      password: 'SecurePass123',
      firstName: 'Jaul',
      lastName: 'Coordinator',
      role: 'GUEST',
      roles: ['GUEST', 'COORDINATOR'],
      department: department._id,
      clusters: ['AI'],
      emailVerified: true,
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'jaul@college.edu',
        password: 'SecurePass123',
        selectedRole: 'COORDINATOR',
      });

    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('COORDINATOR');

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.role).toBe('COORDINATOR');

    const refresh = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refreshToken: login.body.data.refreshToken });
    expect(refresh.status).toBe(200);
    expect(jwt.verify(refresh.body.data.token, process.env.JWT_SECRET).role)
      .toBe('COORDINATOR');

    const event = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validEventPayload);
    expect(event.status).toBe(201);

    const submitted = await request(app)
      .post(`/api/events/${event.body.data._id}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);
    expect(submitted.status).toBe(200);
    expect(EmailService.sendApprovalRequestEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: secondaryCoordinator.email }),
      expect.any(Object)
    );

    const approved = await request(app)
      .post(`/api/events/${event.body.data._id}/approve`)
      .set('Authorization', `Bearer ${refresh.body.data.token}`)
      .send({});
    expect(approved.status).toBe(200);

    expect(secondaryCoordinator.role).toBe('GUEST');
  });

  it('finds Coordinators assigned through a secondary role', async () => {
    const secondaryCoordinator = await User.create({
      email: 'secondary-coordinator@college.edu',
      password: 'SecurePass123',
      firstName: 'Secondary',
      lastName: 'Coordinator',
      role: 'GUEST',
      roles: ['GUEST', 'COORDINATOR'],
      department: department._id,
      clusters: ['AI'],
      emailVerified: true,
    });

    const approvers = await findApprovers({
      departmentId: department._id,
      cluster: 'AI',
      submitter: faculty.user,
    });

    expect(approvers.some((approver) => approver._id.equals(secondaryCoordinator._id))).toBe(true);
  });

  it('requires feedback to reject an event', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validEventPayload);
    const eventId = createRes.body.data._id;

    await request(app)
      .post(`/api/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    const rejectRes = await request(app)
      .post(`/api/events/${eventId}/reject`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({});

    expect(rejectRes.status).toBe(400);
  });

  it('rejects an event with feedback and reflects the final status', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validEventPayload);
    const eventId = createRes.body.data._id;

    await request(app)
      .post(`/api/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    const rejectRes = await request(app)
      .post(`/api/events/${eventId}/reject`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({ feedback: 'Please add more detail to the description.' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('REJECTED');
  });

  it('prevents FACULTY from approving their own event', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send(validEventPayload);
    const eventId = createRes.body.data._id;

    await request(app)
      .post(`/api/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${faculty.token}`);

    const approveRes = await request(app)
      .post(`/api/events/${eventId}/approve`)
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({});

    expect(approveRes.status).toBe(403);
  });
});