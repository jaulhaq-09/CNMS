const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const {
  loginLimiter,
  forgotPasswordLimiter,
  forgotUsernameLimiter,
  verifyEmailLimiter,
  twoFactorLimiter,
} = require('../middleware/rateLimitAuth');
const { validateLogin, validateRecovery } = require('../middleware/validation');

// Public
// Self-registration is disabled: accounts are created only by the Admin (Excel import / Users page).
router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/verify-2fa', twoFactorLimiter, authController.verifyTwoFactorLogin);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', forgotPasswordLimiter, validateRecovery, authController.forgotPassword);
router.post('/forgot-username', forgotUsernameLimiter, validateRecovery, authController.forgotUsername);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-email', verifyEmailLimiter, authController.verifyEmail);

// Protected
router.get('/me', authenticate, authController.getMe);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/resend-verification', authenticate, authController.resendVerification);
router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, authController.logoutAllDevices);
router.post('/setup-2fa', authenticate, authController.setup2FA);
router.post('/confirm-2fa', authenticate, authController.confirmEnable2FA);
router.post('/disable-2fa', authenticate, authController.disable2FA);

module.exports = router;