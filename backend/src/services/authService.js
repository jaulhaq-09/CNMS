const User = require('../models/User');
// Populating 'department' in getUserById() below needs the Department
// schema registered with Mongoose first. Nothing else in this file's
// require chain was importing it, so populate() would throw
// MissingSchemaError the moment a user actually HAD a department set
// (Admin has none, so this went unnoticed until Faculty/Dean/Coordinator
// logged in).
require('../models/Department');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');
const EmailService = require('./emailService');
const TwoFactorUtil = require('../utils/twoFactor');
const AppError = require('../utils/AppError');

class AuthService {
  // Same rules the change-password screen shows.
  static assertStrongPassword(password) {
    const p = String(password || '');
    if (p.length < 8 || !/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/\d/.test(p)) {
      throw new AppError(
        'Password must be at least 8 characters and include an uppercase letter, a lowercase letter and a number.',
        400
      );
    }
  }

  // Finds ONE active user from an email or a phone number.
  // Returns null when nothing matches, or when a phone number is shared by
  // more than one account (we never guess whose it is).
  static async findByIdentifier(identifier) {
    const value = String(identifier || '').trim().toLowerCase();
    if (!value) return null;

    if (value.includes('@')) {
      return User.findOne({ email: value, isActive: true });
    }

    const digits = value.replace(/\D/g, '');
    if (digits.length < 10) return null;
    const last10 = digits.slice(-10);
    // Numbers are stored as digits (optionally with a leading +). Accept the
    // common ways the same Indian number gets typed.
    const matches = await User.find({
      isActive: true,
      phone: { $in: [last10, `91${last10}`, `+91${last10}`, digits, `+${digits}`] },
    }).limit(2);
    return matches.length === 1 ? matches[0] : null;
  }

  static async register(userData) {
    // Self-registration is disabled. Accounts are created only by the Admin.
    throw new AppError('Registration is disabled. Please contact your administrator.', 403);
    // eslint-disable-next-line no-unreachable
    try {
      const existingUser = await User.findOne({ email: userData.email.toLowerCase() });
      if (existingUser) {
        throw new AppError('Email already registered', 409); // Conflict
      }

      const verificationToken = this.generateSecureToken();

      const user = new User({
        ...userData,
        email: userData.email.toLowerCase(),
        emailVerificationToken: this.hashToken(verificationToken),
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      });

      await user.save();

      try {
        await EmailService.sendVerificationEmail(user, verificationToken);
      } catch (emailError) {
        logger.error('Failed to send verification email:', emailError.message);
      }

      const token = this.generateToken(user._id, user.role);
      const refreshToken = this.generateRefreshToken(user._id, user.role);

      user.refreshTokens.push({ token: this.hashToken(refreshToken) });
      await user.save();

      // Re-fetch with department populated so the frontend never has to
      // deal with a raw ObjectId — new users usually have no department
      // yet, but if one was assigned at signup, this makes sure it shows
      // up correctly right away instead of only after a page refresh.
      await user.populate('department', 'name code');

      logger.info(`New user registered: ${user.email}`);

      return {
        user: user.getPublicProfile(),
        token,
        refreshToken,
      };
    } catch (error) {
      logger.error('Registration error:', error.message);
      throw error;
    }
  }

  static async login(email, password, ipAddress, userAgent, selectedRole = null) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() })
        .select('+password +loginAttempts +lockUntil +twoFactorEnabled +twoFactorSecret')
        .populate('department', 'name code'); // <-- was missing; caused raw ObjectId on dashboard

      if (!user) {
        throw new AppError('Invalid email or password', 401); // Unauthorized
      }

      if (user.isLocked) {
        throw new AppError(
          'Account locked due to too many failed attempts. Try again in 30 minutes.',
          423 // Locked
        );
      }

      if (!user.isActive) {
        throw new AppError('User account is inactive', 403); // Forbidden
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        await user.incrementLoginAttempts();
        throw new AppError('Invalid email or password', 401);
      }

      // An imported user's one-time password stops working after its expiry.
      // They can still get in through "Forgot password".
      if (
        user.mustChangePassword &&
        user.tempPasswordExpiresAt &&
        user.tempPasswordExpiresAt < new Date()
      ) {
        throw new AppError(
          'Your temporary password has expired. Use "Forgot password" to set a new one.',
          401
        );
      }

      await user.resetLoginAttempts();

      const userRoles =
        Array.isArray(user.roles) && user.roles.length > 0
          ? user.roles
          : [user.role || 'FACULTY'];

      // If user has multiple roles and has not selected one yet, prompt for role
      if (!selectedRole && userRoles.length > 1) {
        return {
          requiresRoleSelection: true,
          availableRoles: userRoles,
          email: user.email,
        };
      }

      if (selectedRole && !userRoles.includes(selectedRole)) {
        throw new AppError('The selected role is not assigned to your account.', 403);
      }

      const activeRole = selectedRole || userRoles[0] || user.role;

      // Require role selection before issuing a 2FA challenge so the
      // selected role can be preserved in the resulting session.
      if (user.twoFactorEnabled) {
        const challengeToken = this.generateToken(user._id, 'PENDING_2FA', { selectedRole: activeRole });
        logger.info(`2FA challenge issued for: ${user.email}`);
        return { requiresTwoFactor: true, challengeToken };
      }

      user.lastLogin = new Date();

      const token = this.generateToken(user._id, activeRole);
      const refreshToken = this.generateRefreshToken(user._id, activeRole);

      user.refreshTokens.push({ token: this.hashToken(refreshToken), userAgent, ipAddress });
      if (user.refreshTokens.length > 5) {
        user.refreshTokens = user.refreshTokens.slice(-5);
      }
      await user.save();

      const profile = user.getPublicProfile();
      profile.role = activeRole;
      profile.roles = userRoles;

      logger.info(`User logged in: ${user.email} (active role: ${activeRole})`);

      return {
        user: profile,
        token,
        refreshToken,
      };
    } catch (error) {
      logger.error('Login error:', error.message);
      throw error;
    }
  }

  static async verifyTwoFactorLogin(challengeToken, otpCode) {
    try {
      const decoded = this.verifyToken(challengeToken);
      if (decoded.role !== 'PENDING_2FA') {
        throw new AppError('Invalid challenge token', 400);
      }

      const user = await User.findById(decoded.userId)
        .select('+twoFactorSecret +twoFactorBackupCodes')
        .populate('department', 'name code');
      if (!user) throw new AppError('User not found', 404);

      let verified = TwoFactorUtil.verifyToken(user.twoFactorSecret, otpCode);

      if (!verified) {
        const backupCode = user.twoFactorBackupCodes.find(
          (bc) => bc.code === otpCode.toUpperCase() && !bc.used
        );
        if (backupCode) {
          backupCode.used = true;
          verified = true;
        }
      }

      if (!verified) {
        throw new AppError('Invalid 2FA code', 401);
      }

      const activeRole = decoded.selectedRole || user.role;
      const userRoles =
        Array.isArray(user.roles) && user.roles.length > 0
          ? user.roles
          : [user.role || 'FACULTY'];
      if (!userRoles.includes(activeRole)) {
        throw new AppError('This session role is no longer assigned to your account. Please log in again.', 401);
      }

      user.lastLogin = new Date();
      const token = this.generateToken(user._id, activeRole);
      const refreshToken = this.generateRefreshToken(user._id, activeRole);

      user.refreshTokens.push({ token: this.hashToken(refreshToken) });
      await user.save();

      logger.info(`2FA login completed: ${user.email}`);

      const profile = user.getPublicProfile();
      profile.role = activeRole;

      return {
        user: profile,
        token,
        refreshToken,
      };
    } catch (error) {
      logger.error('2FA verification error:', error.message);
      throw error;
    }
  }

  static async refreshAccessToken(refreshToken) {
    try {
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      } catch (err) {
        throw new AppError('Invalid or expired refresh token', 401);
      }

      const hashedToken = this.hashToken(refreshToken);
      const user = await User.findById(decoded.userId).select('+refreshTokens.token');

      if (!user || !user.refreshTokens.some((rt) => rt.token === hashedToken)) {
        throw new AppError('Refresh token not recognized — please log in again', 401);
      }

      const activeRole = decoded.role || user.role;
      const userRoles =
        Array.isArray(user.roles) && user.roles.length > 0
          ? user.roles
          : [user.role || 'FACULTY'];
      if (!userRoles.includes(activeRole)) {
        throw new AppError('This session role is no longer assigned to your account. Please log in again.', 401);
      }

      const token = this.generateToken(user._id, activeRole);
      return { token };
    } catch (error) {
      logger.error('Refresh token error:', error.message);
      throw error;
    }
  }

  static async logout(userId, refreshToken) {
    try {
      if (!refreshToken) return;
      const hashedToken = this.hashToken(refreshToken);
      await User.findByIdAndUpdate(userId, {
        $pull: { refreshTokens: { token: hashedToken } },
      });
      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      logger.error('Logout error:', error.message);
      throw error;
    }
  }

  static async logoutAllDevices(userId) {
    try {
      await User.findByIdAndUpdate(userId, { $set: { refreshTokens: [] } });
      logger.info(`All sessions cleared for user: ${userId}`);
    } catch (error) {
      logger.error('Logout all devices error:', error.message);
      throw error;
    }
  }

  static async forgotPassword(identifier) {
    try {
      const user = await this.findByIdentifier(identifier);
      if (!user) {
        // Don't reveal whether the account exists
        return;
      }

      const resetToken = this.generateSecureToken();
      user.passwordResetToken = this.hashToken(resetToken);
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
      await user.save();

      await EmailService.sendPasswordResetEmail(user, resetToken);
      logger.info(`Password reset requested for: ${user.email}`);
    } catch (error) {
      logger.error('Forgot password error:', error.message);
      throw error;
    }
  }

  // Emails the username to the address on record. Same silent behaviour as above.
  static async forgotUsername(identifier) {
    try {
      const user = await this.findByIdentifier(identifier);
      if (!user) return;
      await EmailService.sendUsernameReminderEmail(user);
      logger.info(`Username reminder sent to: ${user.email}`);
    } catch (error) {
      logger.error('Forgot username error:', error.message);
      throw error;
    }
  }

  static async resetPassword(token, newPassword) {
    try {
      this.assertStrongPassword(newPassword);
      const hashedToken = this.hashToken(token);

      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      }).select('+passwordResetToken +passwordResetExpires');

      if (!user) {
        throw new AppError('Password reset token is invalid or has expired', 400);
      }

      user.password = newPassword; // pre('save') hook hashes it
      user.mustChangePassword = false;
      user.tempPasswordExpiresAt = undefined;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.refreshTokens = []; // force re-login everywhere
      await user.save();

      // The confirmation email is a courtesy. If it fails, the reset still succeeded.
      try {
        await EmailService.sendPasswordChangedEmail(user);
      } catch (mailError) {
        logger.warn(`Password changed email failed for ${user.email}: ${mailError.message}`);
      }
      logger.info(`Password reset completed for: ${user.email}`);

      return { message: 'Password reset successful' };
    } catch (error) {
      logger.error('Reset password error:', error.message);
      throw error;
    }
  }

  static async verifyEmail(token) {
    try {
      const hashedToken = this.hashToken(token);

      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() },
      }).select('+emailVerificationToken +emailVerificationExpires');

      if (!user) {
        throw new AppError('Verification token is invalid or has expired', 400);
      }

      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      logger.info(`Email verified: ${user.email}`);

      return user.getPublicProfile();
    } catch (error) {
      logger.error('Verify email error:', error.message);
      throw error;
    }
  }

  static async resendVerificationEmail(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new AppError('User not found', 404);
      if (user.emailVerified) throw new AppError('Email already verified', 400);

      const verificationToken = this.generateSecureToken();
      user.emailVerificationToken = this.hashToken(verificationToken);
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();

      await EmailService.sendVerificationEmail(user, verificationToken);
      logger.info(`Verification email resent: ${user.email}`);
    } catch (error) {
      logger.error('Resend verification error:', error.message);
      throw error;
    }
  }

  // --- 2FA setup ---
  static async setup2FA(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new AppError('User not found', 404);

      const secret = TwoFactorUtil.generateSecret(user.email);
      const qrCode = await TwoFactorUtil.generateQRCode(secret.otpauthUrl);

      user.twoFactorSecret = secret.base32; // not enabled until confirmed
      await user.save();

      return { qrCode, secret: secret.base32 };
    } catch (error) {
      logger.error('Setup 2FA error:', error.message);
      throw error;
    }
  }

  static async confirmEnable2FA(userId, otpCode) {
    try {
      const user = await User.findById(userId).select('+twoFactorSecret');
      if (!user || !user.twoFactorSecret) throw new AppError('2FA setup not initiated', 400);

      const verified = TwoFactorUtil.verifyToken(user.twoFactorSecret, otpCode);
      if (!verified) throw new AppError('Invalid verification code', 401);

      const backupCodes = TwoFactorUtil.generateBackupCodes();

      user.twoFactorEnabled = true;
      user.twoFactorBackupCodes = backupCodes;
      await user.save();

      await EmailService.sendTwoFactorEnabledEmail(user);
      logger.info(`2FA enabled for: ${user.email}`);

      return { backupCodes: backupCodes.map((bc) => bc.code) };
    } catch (error) {
      logger.error('Confirm 2FA error:', error.message);
      throw error;
    }
  }

  static async disable2FA(userId, password) {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) throw new AppError('User not found', 404);

      const isValid = await user.comparePassword(password);
      if (!isValid) throw new AppError('Incorrect password', 401);

      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      user.twoFactorBackupCodes = [];
      await user.save();

      logger.info(`2FA disabled for: ${user.email}`);
    } catch (error) {
      logger.error('Disable 2FA error:', error.message);
      throw error;
    }
  }

  // --- Google OAuth ---
  static async findOrCreateGoogleUser(profile) {
    try {
      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        user = await User.findOne({ email: profile.emails[0].value.toLowerCase() });

        if (user) {
          user.googleId = profile.id;
          user.authProvider = 'GOOGLE';
          user.emailVerified = true;
          await user.save();
        } else {
          // Only imported users may sign in. Never create accounts from Google.
          throw new AppError('This account is not registered. Please contact your administrator.', 403);
        }
      }

      user.lastLogin = new Date();
      const token = this.generateToken(user._id, user.role);
      const refreshToken = this.generateRefreshToken(user._id, user.role);

      user.refreshTokens.push({ token: this.hashToken(refreshToken) });
      await user.save();
      await user.populate('department', 'name code');

      logger.info(`Google OAuth login: ${user.email}`);

      return { user: user.getPublicProfile(), token, refreshToken };
    } catch (error) {
      logger.error('Google OAuth error:', error.message);
      throw error;
    }
  }

  // --- Token helpers ---
  static generateToken(userId, role, additionalClaims = {}) {
    return jwt.sign(
      { userId, role, ...additionalClaims },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '15m' }
    );
  }

  static generateRefreshToken(userId, role) {
    return jwt.sign(
      { userId, role, type: 'refresh' },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '30d' }
    );
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      const wrapped = new AppError('Invalid or expired token', 401);
      wrapped.name = error.name; // 'TokenExpiredError', 'JsonWebTokenError', etc.
      throw wrapped;
    }
  }

  static generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static async getUserById(userId) {
    try {
      const user = await User.findById(userId).populate('department');
      if (!user) {
        throw new AppError('User not found', 404);
      }
      return user;
    } catch (error) {
      logger.error('Get user error:', error.message);
      throw error;
    }
  }

  // authController.getMe() calls authService.getMe() — that method never
  // existed on this class (only getUserById did), so GET /api/auth/me
  // was throwing "authService.getMe is not a function" on every call.
  static async getMe(userId) {
    return this.getUserById(userId);
  }

  static async changePassword(userId, oldPassword, newPassword) {
    try {
      this.assertStrongPassword(newPassword);
      if (newPassword === oldPassword) {
        throw new AppError('Choose a password different from your current one.', 400);
      }
      const user = await User.findById(userId).select('+password');

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const isValid = await user.comparePassword(oldPassword);
      if (!isValid) {
        throw new AppError('Current password is incorrect', 401);
      }

      user.password = newPassword;
      user.mustChangePassword = false;
      user.tempPasswordExpiresAt = undefined;
      user.refreshTokens = []; // force re-login everywhere
      await user.save();

      try {
        await EmailService.sendPasswordChangedEmail(user);
      } catch (mailError) {
        logger.warn(`Password changed email failed for ${user.email}: ${mailError.message}`);
      }
      logger.info(`Password changed for user: ${user.email}`);

      return { message: 'Password changed successfully' };
    } catch (error) {
      logger.error('Change password error:', error.message);
      throw error;
    }
  }
}

module.exports = AuthService;