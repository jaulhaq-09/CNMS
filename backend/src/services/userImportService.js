const crypto = require('crypto');
const ExcelJS = require('exceljs');
const User = require('../models/User');
const Department = require('../models/Department');
const EmailService = require('./emailService');
const AuditService = require('./auditService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const TEMP_PASSWORD_DAYS = 7;
const MAX_ROWS = 1000;
const EMAIL_GAP_MS = 150; // pause between emails so we stay under provider rate limits
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Optional: set COLLEGE_EMAIL_DOMAIN=bmsit.in in .env to only accept college addresses.
const ALLOWED_DOMAIN = (process.env.COLLEGE_EMAIL_DOMAIN || '').trim().toLowerCase().replace(/^@/, '');

// Accepted header spellings -> internal field
const HEADER_ALIASES = {
  name: 'name', fullname: 'name', facultyname: 'name', employeename: 'name',
  firstname: 'firstName', lastname: 'lastName', surname: 'lastName',
  email: 'email', emailid: 'email', collegeemail: 'email', mail: 'email', gmail: 'email',
  phone: 'phone', mobile: 'phone', mobilenumber: 'phone', phonenumber: 'phone', contact: 'phone', contactnumber: 'phone',
  designation: 'designation', position: 'designation',
  employeeid: 'employeeId', empid: 'employeeId', facultyid: 'employeeId', staffid: 'employeeId',
  department: 'department', dept: 'department', departmentcode: 'department',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const headerKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normDept = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
// eslint-disable-next-line no-control-regex
const clean = (s, max = 100) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// ---- Excel cell helpers ------------------------------------------------

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined) return cellText(v.result);
    if (v.text !== undefined) return cellText(v.text);
    if (v.hyperlink) return String(v.hyperlink).replace(/^mailto:/i, '');
    return '';
  }
  return String(v);
}

function normalizePhone(raw) {
  const s = String(raw || '').trim();
  if (!s) return { value: '' };
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return { error: 'Phone number must have 10 to 15 digits' };
  return { value: (s.startsWith('+') ? '+' : '') + digits };
}

function splitName(row) {
  let first = clean(row.firstName, 60);
  let last = clean(row.lastName, 60);
  if (!first && row.name) {
    const full = clean(row.name, 120).replace(/^(dr|prof|mr|mrs|ms|shri|smt)\.?\s+/i, '');
    const parts = full.split(' ');
    first = parts.shift() || '';
    last = parts.join(' ');
  }
  return { firstName: first, lastName: last || '-' };
}

// ---- Parse -------------------------------------------------------------

async function parseWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (e) {
    throw new AppError('Could not read the file. Please upload a valid .xlsx Excel file.', 400);
  }
  const sheet = wb.worksheets[0];
  if (!sheet) throw new AppError('The Excel file has no sheets.', 400);

  // find the header row (one of the first 5 rows that has an Email column)
  let headerRow = 0;
  let columns = {};
  for (let r = 1; r <= Math.min(5, sheet.rowCount); r += 1) {
    const map = {};
    sheet.getRow(r).eachCell((cell, col) => {
      const field = HEADER_ALIASES[headerKey(cellText(cell.value))];
      if (field && !Object.values(map).includes(field)) map[col] = field;
    });
    if (Object.values(map).includes('email')) {
      headerRow = r;
      columns = map;
      break;
    }
  }
  if (!headerRow) throw new AppError('Could not find an "Email" column. Please use the template.', 400);
  const fields = Object.values(columns);
  if (!fields.includes('name') && !fields.includes('firstName')) {
    throw new AppError('Could not find a "Name" column. Please use the template.', 400);
  }

  const rows = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const item = { rowNumber: r };
    let any = false;
    Object.entries(columns).forEach(([col, field]) => {
      const text = cellText(row.getCell(Number(col)).value).trim();
      if (text) any = true;
      item[field] = text;
    });
    if (!any) continue;
    rows.push(item);
    if (rows.length > MAX_ROWS) throw new AppError(`Too many rows. Please import at most ${MAX_ROWS} at a time.`, 400);
  }
  if (!rows.length) throw new AppError('The file has no data rows.', 400);
  return rows;
}

// ---- Validate ----------------------------------------------------------

async function validateRows(rawRows) {
  const departments = await Department.find({ isActive: true }).select('name code').lean();
  const deptLookup = new Map();
  departments.forEach((d) => {
    deptLookup.set(normDept(d.code), d);
    deptLookup.set(normDept(d.name), d);
  });

  const emails = rawRows.map((r) => String(r.email || '').toLowerCase().replace(/^mailto:/, '').trim()).filter(Boolean);
  const empIds = rawRows.map((r) => clean(r.employeeId, 40)).filter(Boolean);
  const existing = await User.find({
    $or: [{ email: { $in: emails } }, ...(empIds.length ? [{ employeeId: { $in: empIds } }] : [])],
  }).select('email employeeId').lean();
  const existingEmails = new Set(existing.map((u) => u.email));
  const existingIds = new Set(existing.map((u) => u.employeeId).filter(Boolean));

  const seenEmail = new Map();
  const seenId = new Map();
  const valid = [];
  const invalid = [];

  rawRows.forEach((raw) => {
    const errors = [];
    const email = String(raw.email || '').toLowerCase().replace(/^mailto:/, '').trim();
    const { firstName, lastName } = splitName(raw);
    const employeeId = clean(raw.employeeId, 40) || undefined;
    const designation = clean(raw.designation, 80) || undefined;
    const phone = normalizePhone(raw.phone);

    if (!firstName) errors.push('Name is missing');
    if (!email) errors.push('Email is missing');
    else if (!EMAIL_RE.test(email)) errors.push('Email is not valid');
    else if (ALLOWED_DOMAIN && !email.endsWith(`@${ALLOWED_DOMAIN}`)) errors.push(`Email must end with @${ALLOWED_DOMAIN}`);
    else if (existingEmails.has(email)) errors.push('Email is already registered');
    else if (seenEmail.has(email)) errors.push(`Duplicate of row ${seenEmail.get(email)}`);
    if (phone.error) errors.push(phone.error);
    if (employeeId) {
      if (existingIds.has(employeeId)) errors.push('Employee ID is already registered');
      else if (seenId.has(employeeId)) errors.push(`Employee ID repeated from row ${seenId.get(employeeId)}`);
    }

    let department;
    if (raw.department) {
      department = deptLookup.get(normDept(raw.department));
      if (!department) errors.push(`Unknown department "${clean(raw.department, 60)}"`);
    }

    if (email && !seenEmail.has(email)) seenEmail.set(email, raw.rowNumber);
    if (employeeId && !seenId.has(employeeId)) seenId.set(employeeId, raw.rowNumber);

    if (errors.length) {
      invalid.push({ rowNumber: raw.rowNumber, name: `${firstName} ${lastName === '-' ? '' : lastName}`.trim(), email, errors });
    } else {
      valid.push({
        rowNumber: raw.rowNumber,
        firstName,
        lastName,
        email,
        phone: phone.value || undefined,
        designation,
        employeeId,
        departmentId: department ? department._id : undefined,
        departmentName: department ? department.name : '',
      });
    }
  });

  return { valid, invalid };
}

async function previewImport(buffer) {
  const rows = await parseWorkbook(buffer);
  const { valid, invalid } = await validateRows(rows);
  return {
    total: rows.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    sample: valid.slice(0, 50).map((v) => ({
      rowNumber: v.rowNumber,
      name: `${v.firstName} ${v.lastName === '-' ? '' : v.lastName}`.trim(),
      email: v.email,
      phone: v.phone || '',
      designation: v.designation || '',
      employeeId: v.employeeId || '',
      department: v.departmentName,
    })),
    invalid,
  };
}

// ---- Temp password -----------------------------------------------------

function generateTempPassword() {
  const UP = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const LO = 'abcdefghijkmnpqrstuvwxyz';
  const DI = '23456789';
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(UP), pick(UP), pick(LO), pick(LO), pick(LO), pick(LO), pick(DI), pick(DI), pick(DI), pick(UP + LO + DI)];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// ---- Import job (runs in the background) -------------------------------

const jobs = new Map();
let activeJobId = null;

async function processJob(job, rows, actorId) {
  for (const row of rows) {
    try {
      const temp = generateTempPassword();
      const expiresAt = new Date(Date.now() + TEMP_PASSWORD_DAYS * 24 * 60 * 60 * 1000);
      const user = await User.create({
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        designation: row.designation,
        employeeId: row.employeeId,
        department: row.departmentId,
        role: 'GUEST', // Admin assigns the real role afterwards
        password: temp, // hashed by the model's pre-save hook
        mustChangePassword: true,
        tempPasswordExpiresAt: expiresAt,
        emailVerified: true,
        importBatch: job.batchId,
      });
      job.created += 1;

      try {
        await EmailService.sendCredentialsEmail(user, temp, expiresAt);
        await User.updateOne({ _id: user._id }, { $set: { credentialsSentAt: new Date() } });
        job.emailed += 1;
      } catch (mailErr) {
        job.emailFailed += 1;
        job.emailFailures.push({ email: row.email, reason: String(mailErr.message || mailErr).slice(0, 160) });
        logger.error(`Credentials email failed for ${row.email}: ${mailErr.message}`);
      }
    } catch (err) {
      job.failed += 1;
      job.failures.push({ email: row.email, reason: err.code === 11000 ? 'Already registered' : String(err.message).slice(0, 160) });
    }
    await sleep(EMAIL_GAP_MS);
  }

  job.done = true;
  job.finishedAt = new Date();
  activeJobId = null;
  setTimeout(() => jobs.delete(job.batchId), 60 * 60 * 1000).unref?.();

  await AuditService.log(
    'USER_IMPORTED',
    actorId,
    'User',
    actorId,
    { batchId: job.batchId, created: job.created, failed: job.failed, emailed: job.emailed, emailFailed: job.emailFailed },
    `Imported ${job.created} faculty`
  );
}

async function startImport(buffer, actor) {
  if (activeJobId && jobs.get(activeJobId) && !jobs.get(activeJobId).done) {
    throw new AppError('An import is already running. Please wait for it to finish.', 409);
  }
  // Re-check everything on the server. The preview is only a convenience.
  const rows = await parseWorkbook(buffer);
  const { valid, invalid } = await validateRows(rows);
  if (!valid.length) throw new AppError('There are no valid rows to import.', 400);

  const batchId = `IMP-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString('hex')}`;
  const job = {
    batchId, total: valid.length, skipped: invalid.length,
    created: 0, failed: 0, emailed: 0, emailFailed: 0,
    failures: [], emailFailures: [], done: false, startedAt: new Date(),
  };
  jobs.set(batchId, job);
  activeJobId = batchId;

  processJob(job, valid, actor._id).catch((e) => {
    logger.error('Import job crashed:', e.message);
    job.done = true;
    job.crashed = true;
    activeJobId = null;
  });

  return { batchId, total: job.total, skipped: job.skipped };
}

function getJobStatus(batchId) {
  const job = jobs.get(batchId);
  if (!job) throw new AppError('Import status not found (it may have expired). Check the Users page.', 404);
  return job;
}

// ---- Resend credentials ------------------------------------------------

async function resendCredentials(userId, actor) {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'SUPER_ADMIN') throw new AppError('Admin accounts cannot be reset from here.', 403);
  if (!user.isActive) throw new AppError('This account is inactive.', 400);
  if (!user.mustChangePassword) {
    throw new AppError('This user has already set their own password. They can use "Forgot password" on the sign-in page.', 400);
  }

  const temp = generateTempPassword();
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_DAYS * 24 * 60 * 60 * 1000);
  user.password = temp;
  user.tempPasswordExpiresAt = expiresAt;
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.refreshTokens = [];
  await user.save();

  await EmailService.sendCredentialsEmail(user, temp, expiresAt);
  await User.updateOne({ _id: user._id }, { $set: { credentialsSentAt: new Date() } });

  await AuditService.log('USER_CREDENTIALS_RESENT', actor._id, 'User', user._id, {}, `${user.firstName} ${user.lastName}`.trim());
  return { email: user.email };
}

// ---- Template ----------------------------------------------------------

async function buildTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Faculty');
  ws.columns = [
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Designation', key: 'designation', width: 24 },
    { header: 'Employee ID', key: 'employeeId', width: 16 },
    { header: 'Department', key: 'department', width: 16 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2340' } };
  ws.addRow({
    name: 'Dr. Asha Rao', email: 'asha.rao@yourcollege.edu', phone: '9876543210',
    designation: 'Associate Professor', employeeId: 'EMP1001', department: 'CSE',
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const depts = await Department.find({ isActive: true }).select('name code').sort({ name: 1 }).lean();
  const ref = wb.addWorksheet('Departments (reference)');
  ref.columns = [{ header: 'Code', key: 'code', width: 14 }, { header: 'Name', key: 'name', width: 44 }];
  ref.getRow(1).font = { bold: true };
  depts.forEach((d) => ref.addRow({ code: d.code, name: d.name }));

  const notes = wb.addWorksheet('Read me');
  notes.getColumn(1).width = 90;
  [
    'Fill the "Faculty" sheet. Delete the sample row first.',
    'Required: Name, Email. Everything else is optional.',
    'Email becomes the person\'s username. Each email must be unique.',
    'Department: use a code or name from the reference sheet. Leave blank if unknown.',
    'Roles, clusters and sections are assigned afterwards in the app, not in this file.',
    'Up to 1000 rows per upload.',
  ].forEach((t) => notes.addRow([t]));

  return wb.xlsx.writeBuffer();
}

module.exports = {
  buildTemplate, previewImport, startImport, getJobStatus, resendCredentials, generateTempPassword,
  // exported for testing
  parseWorkbook, validateRows,
};