const authService = require('../services/authService');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

exports.register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);
  logger.info(`New user registered: ${result.user.email}`);
  res.status(201).json({
    success: true,
    message: 'Registration successful. Please check your email to verify your account.',
    data: result,
  });
});

exports.login = catchAsync(async (req, res) => {
  const { email, password, selectedRole } = req.body;
  const result = await authService.login(
    email,
    password,
    req.ip,
    req.headers['user-agent'],
    selectedRole
  );

  if (result.requiresTwoFactor) {
    return res.status(200).json({
      success: true,
      requiresTwoFactor: true,
      message: 'Enter your 2FA code to continue',
      data: { challengeToken: result.challengeToken },
    });
  }

  if (result.requiresRoleSelection) {
    return res.status(200).json({
      success: true,
      requiresRoleSelection: true,
      message: 'Please choose which role to continue as',
      data: {
        requiresRoleSelection: true,
        availableRoles: result.availableRoles,
        email: result.email,
      },
    });
  }

  logger.info(`User logged in: ${email}`);
  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: result,
  });
});

exports.verifyTwoFactorLogin = catchAsync(async (req, res) => {
  const { challengeToken, otpCode } = req.body;
  const result = await authService.verifyTwoFactorLogin(challengeToken, otpCode);
  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: result,
  });
});

exports.refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token required' });
  }
  const result = await authService.refreshAccessToken(refreshToken);
  res.status(200).json({ success: true, data: result });
});

exports.getMe = catchAsync(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  res.status(200).json({ success: true, data: user });
});

exports.changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user._id, currentPassword, newPassword);
  res.status(200).json({ success: true, message: 'Password changed successfully' });
});

const RECOVERY_MESSAGE =
  'If we found a matching account, an email has been sent to the address on record.';

// The work happens AFTER we reply, so how long the response takes can never
// reveal whether an account exists.
exports.forgotPassword = catchAsync(async (req, res) => {
  const identifier = req.body.identifier || req.body.email;
  authService
    .forgotPassword(identifier)
    .catch((e) => logger.error('Forgot password failed:', e.message));
  res.status(200).json({ success: true, message: RECOVERY_MESSAGE });
});

exports.forgotUsername = catchAsync(async (req, res) => {
  authService
    .forgotUsername(req.body.identifier)
    .catch((e) => logger.error('Forgot username failed:', e.message));
  res.status(200).json({ success: true, message: RECOVERY_MESSAGE });
});

exports.resetPassword = catchAsync(async (req, res) => {
  const { token, newPassword } = req.body;
  await authService.resetPassword(token, newPassword);
  res.status(200).json({ success: true, message: 'Password reset successful. Please log in.' });
});

exports.verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.body;
  const user = await authService.verifyEmail(token);
  res.status(200).json({ success: true, message: 'Email verified successfully', data: user });
});

exports.resendVerification = catchAsync(async (req, res) => {
  await authService.resendVerificationEmail(req.user._id);
  res.status(200).json({ success: true, message: 'Verification email sent' });
});

exports.logout = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  await authService.logout(req.user._id, refreshToken);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

exports.logoutAllDevices = catchAsync(async (req, res) => {
  await authService.logoutAllDevices(req.user._id);
  res.status(200).json({ success: true, message: 'Logged out from all devices' });
});

// --- 2FA ---
exports.setup2FA = catchAsync(async (req, res) => {
  const result = await authService.setup2FA(req.user._id);
  res.status(200).json({ success: true, data: result });
});

exports.confirmEnable2FA = catchAsync(async (req, res) => {
  const { otpCode } = req.body;
  const result = await authService.confirmEnable2FA(req.user._id, otpCode);
  res.status(200).json({
    success: true,
    message: '2FA enabled successfully. Save your backup codes!',
    data: result,
  });
});

exports.disable2FA = catchAsync(async (req, res) => {
  const { password } = req.body;
  await authService.disable2FA(req.user._id, password);
  res.status(200).json({ success: true, message: '2FA disabled' });
});

// --- Google OAuth callback ---
exports.googleCallback = catchAsync(async (req, res) => {
  const { accessToken, refreshToken, user } = req.user; // set by passport
  const redirectUrl = `${process.env.CLIENT_URL}/oauth-callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;
  res.redirect(redirectUrl);
});