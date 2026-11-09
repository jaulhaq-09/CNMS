const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /.+\@.+\..+/,
  },
  password: {
    type: String,
    minlength: 6,
    select: false,
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, trim: true },
  profilePhoto: String,

  // --- Faculty details (filled from the Admin's Excel import) ---
  designation: { type: String, trim: true },
  employeeId: { type: String, trim: true },

  // --- Imported-account onboarding ---
  // Admin import creates the account with a one-time temporary password.
  // While mustChangePassword is true the user is forced to set their own
  // password on first login; the temp password stops working after expiry.
  mustChangePassword: { type: Boolean, default: false },
  tempPasswordExpiresAt: Date,
  importBatch: { type: String, trim: true }, // groups users from the same Excel upload
  credentialsSentAt: Date, // when the username/temp-password email last went out
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'COORDINATOR', 'FACULTY', 'GUEST'],
    default: 'GUEST',
  },
  roles: {
    type: [String],
    default: function () {
      return this.role ? [this.role] : ['FACULTY'];
    },
  },
  // CHANGED — a single string could only represent one home assignment.
  // A teacher can now belong to multiple clusters/sections within their
  // one department (e.g. teaches in both the AI cluster and the Data
  // Science cluster). Department stays singular — one home department
  // per person is still the assumption here.
  clusters: [String],
  sections: [String],
  permissions: [String],
  isActive: {
    type: Boolean,
    default: true,
  },

  // --- Auth provider ---
  googleId: {
    type: String,
    sparse: true,
  },
  authProvider: {
    type: String,
    enum: ['LOCAL', 'GOOGLE'],
    default: 'LOCAL',
  },

  // --- Email verification (NEW) ---
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    select: false,
  },
  emailVerificationExpires: {
    type: Date,
    select: false,
  },

  // --- Password reset (NEW) ---
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },

  // --- Refresh tokens (NEW) ---
  refreshTokens: [
    {
      token: { type: String, select: false },
      createdAt: { type: Date, default: Date.now },
      userAgent: String,
      ipAddress: String,
    },
  ],

  // --- Login lockout (NEW) ---
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: Date,

  // --- 2FA (your fields kept, backup codes added) ---
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorSecret: {
    type: String,
    select: false,
  },
  twoFactorBackupCodes: [
    {
      code: { type: String, select: false },
      used: { type: Boolean, default: false },
    },
  ],

  notificationPreferences: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    weeklyDigest: { type: Boolean, default: true },
    quietHours: {
      enabled: { type: Boolean, default: false },
      startTime: String,
      endTime: String,
    },
  },

  lastLogin: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// --- Existing hook — this is the single source of truth for hashing ---
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.getPublicProfile = function () {
  const user = this.toObject();
  delete user.password;
  delete user.twoFactorSecret;
  delete user.twoFactorBackupCodes;
  delete user.refreshTokens;
  delete user.passwordResetToken;
  delete user.emailVerificationToken;
  return user;
};

// --- Account lockout helpers (NEW) ---
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.methods.incrementLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 30 * 60 * 1000;

  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};

userSchema.set('toObject', { virtuals: true });
userSchema.set('toJSON', { virtuals: true });

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ department: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ importBatch: 1 });
userSchema.index({ employeeId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);