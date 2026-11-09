const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AuthService = require('../services/authService');
const logger = require('../utils/logger');

// Google OAuth is optional — registering the strategy without a
// clientID/clientSecret throws synchronously and crashes the entire
// server before it can bind to its port (e.g. in a Docker container
// that doesn't have these env vars set). Skip registration gracefully
// instead; every other login method (email/password, 2FA) keeps
// working normally, "Sign in with Google" just won't be available
// until real credentials are supplied.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const result = await AuthService.findOrCreateGoogleUser(profile);
          done(null, result);
        } catch (error) {
          logger.error('Google OAuth error:', error.message);
          done(error, null);
        }
      }
    )
  );
} else {
  logger.warn(
    '[passport] GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set — Google OAuth login disabled.'
  );
}

module.exports = passport;