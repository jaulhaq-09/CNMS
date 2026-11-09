const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');

class TokenService {
  static generateAccessToken(userId, role) {
    return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '15m',
      algorithm: 'HS256',
    });
  }

  static generateRefreshToken(userId) {
    return jwt.sign({ id: userId, type: 'refresh' }, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '30d',
      algorithm: 'HS256',
    });
  }

  static verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  static verifyRefreshToken(token) {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  }

  // Secure random tokens for email verification / password reset
  static generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static getTokenExpiry(hours = 1) {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }
}

module.exports = TokenService;