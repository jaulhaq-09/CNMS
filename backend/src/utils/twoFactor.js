const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');

class TwoFactorUtil {
  static generateSecret(userEmail) {
    const secret = speakeasy.generateSecret({
      name: `CNMS (${userEmail})`,
      length: 32,
    });

    return {
      base32: secret.base32,
      otpauthUrl: secret.otpauth_url,
    };
  }

  static async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error('Failed to generate QR code');
    }
  }

  static verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Allow 1 step before/after for clock drift
    });
  }

  static generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push({ code, used: false });
    }
    return codes;
  }
}

module.exports = TwoFactorUtil;