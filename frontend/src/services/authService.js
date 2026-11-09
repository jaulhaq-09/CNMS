import api from './api'

const authService = {
  // --- API calls ---
  login: (email, password) => api.post('/api/auth/login', { email, password }),

  verify2FA: (challengeToken, otpCode) =>
    api.post('/api/auth/verify-2fa', { challengeToken, otpCode }),

  register: (userData) => api.post('/api/auth/register', userData),

  forgotPassword: (identifier) => api.post('/api/auth/forgot-password', { identifier }),

  forgotUsername: (identifier) => api.post('/api/auth/forgot-username', { identifier }),

  resetPassword: (token, newPassword) =>
    api.post('/api/auth/reset-password', { token, newPassword }),

  verifyEmail: (token) => api.post('/api/auth/verify-email', { token }),

  resendVerification: () => api.post('/api/auth/resend-verification'),

  getMe: () => api.get('/api/auth/me'),

  changePassword: (currentPassword, newPassword) =>
    api.post('/api/auth/change-password', { currentPassword, newPassword }),

  logout: (refreshToken) => api.post('/api/auth/logout', { refreshToken }),

  logoutAllDevices: () => api.post('/api/auth/logout-all'),

  setup2FA: () => api.post('/api/auth/setup-2fa'),

  confirm2FA: (otpCode) => api.post('/api/auth/confirm-2fa', { otpCode }),

  disable2FA: (password) => api.post('/api/auth/disable-2fa', { password }),

  googleLoginUrl: () => `http://localhost:5000/api/auth/google`,

  // --- Local, synchronous helpers (no API call) ---
  // These read whatever authSlice already wrote to localStorage on login,
  // so hooks like useNotifications can check auth state without hitting Redux.
  getToken: () => localStorage.getItem('cnms_token'),

  getRefreshToken: () => localStorage.getItem('cnms_refresh_token'),

  getUser: () => {
    try {
      const raw = localStorage.getItem('cnms_user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },

  isAuthenticated: () => !!localStorage.getItem('cnms_token'),
}

export default authService