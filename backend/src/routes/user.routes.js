const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Cluster = require('../models/Cluster');
const Section = require('../models/Section');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const uploadProfile = require('../middleware/uploadProfile');
const logger = require('../utils/logger');
const AuditService = require('../services/auditService');
const { validateCreateUser } = require('../middleware/validation');

const asList = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
const idStr = (v) => String((v && v._id) || v || '');

// Checks that the department / cluster / section choices are real and that a
// cluster never ends up with two Coordinators.
// Returns an error message, or null when everything is fine.
async function checkScope({ role, department, clusters = [], sections = [], excludeIds = [] }) {
  if (role !== 'COORDINATOR' && role !== 'FACULTY') return null;
  if (!department || !mongoose.isValidObjectId(idStr(department))) return 'Please choose a department.';
  if (role === 'COORDINATOR' && !clusters.length) return 'Please choose at least one cluster.';

  const found = await Cluster.find({
    department: idStr(department),
    isActive: true,
    name: { $in: clusters },
  }).select('name');
  if (found.length !== new Set(clusters).size) {
    return 'One or more clusters do not belong to this department.';
  }

  if (sections.length) {
    const secs = await Section.find({
      cluster: { $in: found.map((c) => c._id) },
      isActive: true,
      name: { $in: sections },
    }).select('name');
    const have = new Set(secs.map((s) => s.name));
    if (sections.some((s) => !have.has(s))) {
      return 'One or more sections do not belong to the chosen clusters.';
    }
  }

  if (role === 'COORDINATOR') {
    const clash = await User.findOne({
      $or: [{ role: 'COORDINATOR' }, { roles: 'COORDINATOR' }],
      isActive: true,
      department: idStr(department),
      clusters: { $in: clusters },
      _id: { $nin: excludeIds },
    }).select('firstName lastName clusters');
    if (clash) {
      const shared = clash.clusters.filter((c) => clusters.includes(c));
      return `${clash.firstName} ${clash.lastName} is already the Coordinator of ${shared.join(', ')}. A cluster can have only one Coordinator.`;
    }
  }
  return null;
}

router.get('/profile', authenticate, (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.getPublicProfile(),
    });
  } catch (error) {
    logger.error('Get profile error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const { firstName, lastName, phone, profilePhoto, notificationPreferences } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        firstName: firstName || req.user.firstName,
        lastName: lastName || req.user.lastName,
        phone: phone !== undefined ? phone : req.user.phone,
        profilePhoto: profilePhoto || req.user.profilePhoto,
        notificationPreferences: notificationPreferences || req.user.notificationPreferences,
        updatedAt: new Date(),
      },
      { new: true }
    ).populate('department', 'name code');

    logger.info(`User profile updated: ${user.email}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user.getPublicProfile(),
    });
  } catch (error) {
    logger.error('Update profile error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Upload/replace the current user's profile photo. Separate from
// PUT /profile (which only accepts a profilePhoto STRING/URL) because
// this one actually handles the multipart file itself via Multer.
router.post('/profile/photo', authenticate, uploadProfile.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file was uploaded',
      });
    }

    const newPhotoUrl = `/uploads/profiles/${req.file.filename}`;
    const previousPhoto = req.user.profilePhoto;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: newPhotoUrl, updatedAt: new Date() },
      { new: true }
    ).populate('department', 'name code');

    // Best-effort cleanup of the old file — non-fatal if it fails (e.g.
    // already missing), since the DB record is already correctly updated.
    if (previousPhoto && previousPhoto.startsWith('/uploads/profiles/')) {
      const oldPath = path.join(__dirname, '..', '..', previousPhoto);
      fs.unlink(oldPath, () => {});
    }

    logger.info(`Profile photo updated: ${user.email}`);

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      data: user.getPublicProfile(),
    });
  } catch (error) {
    logger.error('Upload profile photo error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// SUPER_ADMIN only — head-counts for the tabs on the Users page
router.get('/summary', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const allUsers = await User.find({}).select('role roles');
    const byRole = {
      SUPER_ADMIN: 0,
      COORDINATOR: 0,
      FACULTY: 0,
    };
    let total = allUsers.length;
    allUsers.forEach((u) => {
      const userRoles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role || 'FACULTY'];
      const seen = new Set();
      userRoles.forEach((r) => {
        if (!seen.has(r)) {
          seen.add(r);
          if (byRole[r] !== undefined) {
            byRole[r] = (byRole[r] || 0) + 1;
          }
        }
      });
      if (u.role && !seen.has(u.role) && byRole[u.role] !== undefined) {
        byRole[u.role] = (byRole[u.role] || 0) + 1;
      }
    });
    res.json({ success: true, data: { total, byRole } });
  } catch (error) {
    logger.error('User summary error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('department');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user.getPublicProfile(),
    });
  } catch (error) {
    logger.error('Get user error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// SUPER_ADMIN only — list all users with optional filters/pagination
router.get('/', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const { role, department, search, page = 1, limit = 20 } = req.query;

    const filter = {};
    const conditions = [];
    if (role) {
      conditions.push({ $or: [{ role }, { roles: role }] });
    }
    if (department) filter.department = department;
    if (search) {
      conditions.push({ $or: [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ] });
    }
    if (conditions.length) filter.$and = conditions;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .populate('department', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: users.map((u) => u.getPublicProfile()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('List users error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// SUPER_ADMIN only — create a user with role/department/scope set directly
router.post('/', authenticate, authorize('SUPER_ADMIN'), ...validateCreateUser, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, department, clusters, sections, employeeId } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const assignedClusters = asList(clusters);
    const assignedSections = asList(sections);
    if (role === 'COORDINATOR') {
      const scopeError = await checkScope({
        role,
        department,
        clusters: assignedClusters,
        sections: assignedSections,
      });
      if (scopeError) {
        return res.status(400).json({ success: false, message: scopeError });
      }
    }

    const user = new User({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      role,
      roles: [role],
      employeeId: employeeId || undefined,
      department: department || undefined,
      clusters: assignedClusters,
      sections: assignedSections,
      emailVerified: true, // admin-created, skip verification flow
    });

    await user.save();
    await user.populate('department', 'name code');

    logger.info(`User created by admin: ${user.email} (${user.role})`);

    await AuditService.log(
      'USER_CREATED',
      req.user._id,
      'User',
      user._id,
      { email: user.email, role: user.role },
      `${user.firstName} ${user.lastName}`
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user.getPublicProfile(),
    });
  } catch (error) {
    logger.error('Create user error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// SUPER_ADMIN only — update role, department, cluster/section scope, or active status

// Admin edits a person's name or login email.
router.put('/:id/details', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const body = req.body || {};
    const changes = {};

    if (typeof body.name === 'string') {
      const words = body.name.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
      if (words.length === 0) {
        return res.status(400).json({ success: false, message: 'Name cannot be empty' });
      }
      // Same rule as the Excel import: the last word is the surname.
      changes.lastName = words.length > 1 ? words.pop().slice(0, 50) : '-';
      changes.firstName = words.join(' ').slice(0, 50);
    }

    if (typeof body.email === 'string') {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address' });
      }
      const domain = (process.env.COLLEGE_EMAIL_DOMAIN || '').trim().toLowerCase().replace(/^@/, '');
      if (domain && !email.endsWith(`@${domain}`)) {
        return res.status(400).json({ success: false, message: `Email must end with @${domain}` });
      }
      if (email !== user.email) {
        const taken = await User.findOne({ email, _id: { $ne: user._id } }).select('_id');
        if (taken) {
          return res.status(409).json({ success: false, message: 'That email is already used by another account' });
        }
        changes.email = email;
      }
    }

    if (typeof body.employeeId === 'string') {
      const employeeId = body.employeeId.trim();
      if (employeeId.length > 100) {
        return res.status(400).json({ success: false, message: 'Username must be 100 characters or fewer' });
      }
      if (employeeId && employeeId !== user.employeeId) {
        const taken = await User.findOne({ employeeId, _id: { $ne: user._id } }).select('_id');
        if (taken) {
          return res.status(409).json({ success: false, message: 'That username is already used by another account' });
        }
      }
      changes.employeeId = employeeId || undefined;
    }

    if (Object.keys(changes).length === 0) {
      return res.json({
        success: true,
        message: 'Nothing changed',
        data: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          employeeId: user.employeeId,
        },
      });
    }

    const emailChanged = Boolean(changes.email);
    const oldEmail = user.email;
    Object.assign(user, changes);
    // A new login address means any session on the old one must end.
    if (emailChanged) user.refreshTokens = [];
    await user.save();

    // Someone who has not signed in yet was sent their temporary password at
    // the old address, so send a fresh one to the new address.
    let credentialsResent = false;
    if (emailChanged && user.mustChangePassword && user.role !== 'SUPER_ADMIN') {
      try {
        await require('../services/userImportService').resendCredentials(user._id, req.user);
        credentialsResent = true;
      } catch (mailErr) {
        logger.error('Credentials resend after email change failed:', mailErr.message);
      }
    }

    await AuditService.log(
      'USER_ACCESS_UPDATED',
      req.user._id,
      'User',
      user._id,
      { changed: Object.keys(changes), ...(emailChanged ? { oldEmail, newEmail: user.email } : {}) },
      `${user.firstName} ${user.lastName}`.trim()
    );

    let message = 'Details updated';
    if (emailChanged) {
      message = credentialsResent
        ? 'Email changed. A new temporary password was sent to the new address.'
        : 'Email changed. They must sign in with the new address.';
    }

    res.json({
      success: true,
      message,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        employeeId: user.employeeId,
      },
    });
  } catch (error) {
    logger.error('Update user details error:', error.message);
    res.status(500).json({ success: false, message: 'Could not update this user' });
  }
});

router.put('/:id/roles', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one role is required' });
    }
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (target.isActive && roles.includes('COORDINATOR')) {
      const scopeError = await checkScope({
        role: 'COORDINATOR',
        department: target.department,
        clusters: target.clusters || [],
        sections: target.sections || [],
        excludeIds: [target._id],
      });
      if (scopeError) {
        return res.status(400).json({ success: false, message: scopeError });
      }
    }

    target.roles = roles;
    target.role = roles[0];
    await target.save();

    res.json({
      success: true,
      message: 'Roles updated successfully',
      data: target,
    });
  } catch (error) {
    logger.error('Update roles error:', error.message);
    res.status(500).json({ success: false, message: 'Could not update user roles' });
  }
});

router.put('/:id/access', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const { role, roles, department, clusters, sections, isActive } = req.body;

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Protect admin access
    const losingAdmin =
      target.role === 'SUPER_ADMIN' &&
      ((role !== undefined && role !== 'SUPER_ADMIN') || isActive === false);
    if (losingAdmin) {
      if (idStr(target._id) === idStr(req.user._id)) {
        return res.status(400).json({ success: false, message: 'You cannot remove your own admin access.' });
      }
      const admins = await User.countDocuments({
        $or: [{ role: 'SUPER_ADMIN' }, { roles: 'SUPER_ADMIN' }],
        isActive: true,
      });
      if (admins <= 1) {
        return res.status(400).json({ success: false, message: 'You cannot remove the last Admin.' });
      }
    }

    // Validate scope only when something that affects it is actually changing
    // "None" for department: clear it, clear cluster/section, and drop to No access
    // (a Faculty or Coordinator without a department cannot post or approve).
    const clearingDepartment = department === null || department === '';
    const demoteOnClear =
      clearingDepartment && target.role !== 'SUPER_ADMIN' && (role === undefined || role === target.role);
    const nextRole = demoteOnClear ? 'GUEST' : role !== undefined ? role : target.role;
    const nextScopeRole =
      nextRole === 'COORDINATOR' || (target.roles || []).includes('COORDINATOR')
        ? 'COORDINATOR'
        : nextRole;
    const nextActive = isActive !== undefined ? isActive : target.isActive;
    const nextDept = clearingDepartment ? null : department !== undefined ? department : target.department;
    const nextClusters = clearingDepartment ? [] : clusters !== undefined ? asList(clusters) : target.clusters;
    const clearingClusters = clusters !== undefined && nextClusters.length === 0;
    const nextSections =
      clearingDepartment || clearingClusters
        ? []
        : sections !== undefined
          ? asList(sections)
          : target.sections;
    const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    const departmentChanged = idStr(nextDept) !== idStr(target.department);
    const resettingScopeForDepartmentChange =
      departmentChanged &&
      nextClusters.length === 0 &&
      nextSections.length === 0 &&
      (role === undefined || role === target.role);
    const scopeChanged =
      nextRole !== target.role ||
      idStr(nextDept) !== idStr(target.department) ||
      !same(nextClusters, target.clusters || []) ||
      !same(nextSections, target.sections || []) ||
      (isActive === true && !target.isActive);
    if (nextActive && scopeChanged && !resettingScopeForDepartmentChange) {
      const msg = await checkScope({
        role: nextScopeRole,
        department: nextDept,
        clusters: nextClusters,
        sections: nextSections,
        excludeIds: [target._id],
      });
      if (msg) return res.status(400).json({ success: false, message: msg });
    }

    const update = { updatedAt: new Date() };
    if (role !== undefined) {
      update.role = role;
      update.roles = [...new Set([...(target.roles || []), role])];
    }
    if (department !== undefined) update.department = department;
    if (clusters !== undefined) update.clusters = clusters;
    if (sections !== undefined || clearingClusters) update.sections = nextSections;
    if (isActive !== undefined) update.isActive = isActive;
    if (clearingDepartment) {
      update.department = null;
      update.clusters = [];
      update.sections = [];
      if (demoteOnClear) {
        update.role = 'GUEST';
        update.roles = ['GUEST'];
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).populate('department', 'name code');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    logger.info(`User access updated by admin: ${user.email}`);

    await AuditService.log(
      'USER_ACCESS_UPDATED',
      req.user._id,
      'User',
      user._id,
      { role, department, clusters, sections, isActive },
      `${user.firstName} ${user.lastName}`
    );

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user.getPublicProfile(),
    });
  } catch (error) {
    logger.error('Update user access error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// SUPER_ADMIN only — assign the same role/scope to many people at once
router.put('/bulk-access', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const { userIds, role, department } = req.body;
    const clusters = asList(req.body.clusters);
    const sections = asList(req.body.sections);

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one person.' });
    }
    if (userIds.length > 200) {
      return res.status(400).json({ success: false, message: 'Select at most 200 people at a time.' });
    }
    if (!userIds.every((id) => mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: 'Invalid user selection.' });
    }
    if (!['COORDINATOR', 'FACULTY', 'GUEST'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Choose Faculty, Coordinator or No access.' });
    }
    if (role === 'COORDINATOR' && userIds.length > 1) {
      return res.status(400).json({
        success: false,
        message: 'A cluster has only one Coordinator, so assign Coordinators one at a time.',
      });
    }

    const found = await User.find({
      _id: { $in: userIds },
      role: { $ne: 'SUPER_ADMIN' },
      isActive: true,
    }).select('firstName lastName');
    const targets = found.filter((t) => idStr(t._id) !== idStr(req.user._id));
    if (targets.length === 0) {
      return res.status(400).json({ success: false, message: 'None of the selected people can be changed.' });
    }

    const msg = await checkScope({
      role,
      department,
      clusters,
      sections,
      excludeIds: targets.map((t) => t._id),
    });
    if (msg) return res.status(400).json({ success: false, message: msg });

    const $set =
      role === 'GUEST'
        ? { role, clusters: [], sections: [], updatedAt: new Date() }
        : { role, department, clusters, sections, updatedAt: new Date() };
    await User.updateMany({ _id: { $in: targets.map((t) => t._id) } }, { $set });

    for (const t of targets) {
      await AuditService.log(
        'USER_ACCESS_UPDATED',
        req.user._id,
        'User',
        t._id,
        { role, department, clusters, sections, bulk: true },
        `${t.firstName} ${t.lastName}`
      );
    }

    res.json({
      success: true,
      message: `${targets.length} ${targets.length === 1 ? 'person' : 'people'} updated`,
      data: { updated: targets.length, skipped: userIds.length - targets.length },
    });
  } catch (error) {
    logger.error('Bulk access error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// SUPER_ADMIN only — the faculty who work under one Coordinator:
// same department, and at least one cluster in common (all sections of it).
router.get('/:id/team', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    const coordinator = await User.findById(req.params.id).select('role roles department clusters');
    if (!coordinator) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (
      coordinator.role !== 'COORDINATOR' &&
      !(coordinator.roles || []).includes('COORDINATOR')
    ) {
      return res.status(400).json({ success: false, message: 'This person is not a Coordinator.' });
    }

    const clusters = coordinator.clusters || [];
    if (!coordinator.department || clusters.length === 0) {
      return res.json({ success: true, data: { members: [] } });
    }

    const people = await User.find({
      $or: [{ role: 'FACULTY' }, { roles: 'FACULTY' }],
      department: coordinator.department,
      clusters: { $in: clusters },
    })
      .select('firstName lastName email clusters sections isActive')
      .sort({ firstName: 1, lastName: 1 });

    const members = people.map((p) => ({
      _id: p._id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      isActive: p.isActive,
      sections: p.sections || [],
      sharedClusters: (p.clusters || []).filter((c) => clusters.includes(c)),
    }));

    res.json({ success: true, data: { members } });
  } catch (error) {
    logger.error('Coordinator team error:', error.message);
    res.status(500).json({ success: false, message: 'Could not load the faculty list' });
  }
});

// SUPER_ADMIN only — permanently delete a user
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }

    if (user.role === 'SUPER_ADMIN') {
      const admins = await User.countDocuments({
        $or: [{ role: 'SUPER_ADMIN' }, { roles: 'SUPER_ADMIN' }],
      });
      if (admins <= 1) {
        return res.status(400).json({ success: false, message: 'You cannot delete the last Admin.' });
      }
    }

    await User.findByIdAndDelete(user._id);
    logger.info(`User deleted: ${user.email} by ${req.user.email}`);

    // Audit is best-effort: a logging problem must never undo or block the delete.
    try {
      await AuditService.log(
        'USER_DELETED',
        req.user._id,
        'User',
        user._id,
        { email: user.email, role: user.role },
        `${user.firstName} ${user.lastName}`
      );
    } catch (auditErr) {
      logger.warn(`Audit log for user delete failed: ${auditErr.message}`);
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;