const emailTemplates = {
  verifyEmail: (firstName, verifyUrl) => ({
    subject: 'Verify Your CNMS Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Welcome to CNMS, ${firstName}!</h2>
        <p>Please verify your email address to activate your account.</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Verify Email
        </a>
        <p style="color: #999; font-size: 12px;">This link expires in 24 hours. If you didn't create this account, ignore this email.</p>
      </div>
    `,
  }),

  passwordReset: (firstName, resetUrl) => ({
    subject: 'Reset Your CNMS Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Password Reset Request</h2>
        <p>Hi ${firstName}, we received a request to reset your password.</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Reset Password
        </a>
        <p style="color: #999; font-size: 12px;">This link expires in 1 hour. If you didn't request this, please ignore this email or contact support.</p>
      </div>
    `,
  }),

  passwordChanged: (firstName) => ({
    subject: 'Your CNMS Password Was Changed',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Password Changed</h2>
        <p>Hi ${firstName}, your password was just changed.</p>
        <p style="color: #c33;">If you didn't make this change, contact support immediately.</p>
      </div>
    `,
  }),

  twoFactorEnabled: (firstName) => ({
    subject: 'Two-Factor Authentication Enabled',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">2FA Enabled</h2>
        <p>Hi ${firstName}, two-factor authentication has been enabled on your account.</p>
        <p>Keep your backup codes safe — you'll need them if you lose access to your authenticator app.</p>
      </div>
    `,
  }),

  suspiciousLogin: (firstName, ipAddress, location) => ({
    subject: 'New Login to Your CNMS Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff9800;">New Login Detected</h2>
        <p>Hi ${firstName}, we noticed a new login to your account.</p>
        <p><strong>IP Address:</strong> ${ipAddress}</p>
        <p style="color: #999; font-size: 12px;">If this wasn't you, reset your password immediately.</p>
      </div>
    `,
  }),
};

module.exports = emailTemplates;