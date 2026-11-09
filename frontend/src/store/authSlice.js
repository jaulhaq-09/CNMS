import { createSlice } from '@reduxjs/toolkit'
import { disconnectSocket } from '../services/socket'

const storedUser = (() => {
  try {
    const raw = localStorage.getItem('cnms_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})()

const initialState = {
  user: storedUser,
  token: localStorage.getItem('cnms_token') || null,
  refreshToken: localStorage.getItem('cnms_refresh_token') || null,
  isAuthenticated: !!localStorage.getItem('cnms_token'),
  loading: false,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true
      state.error = null
    },
    loginSuccess: (state, action) => {
      const { user, token, refreshToken } = action.payload
      state.user = user
      state.token = token
      state.refreshToken = refreshToken
      state.isAuthenticated = true
      state.loading = false
      state.error = null

      localStorage.setItem('cnms_token', token)
      if (refreshToken) localStorage.setItem('cnms_refresh_token', refreshToken)
      localStorage.setItem('cnms_user', JSON.stringify(user))
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload }
      localStorage.setItem('cnms_user', JSON.stringify(state.user))
    },
    loginFailure: (state, action) => {
      state.loading = false
      state.error = action.payload
    },
    tokenRefreshed: (state, action) => {
      state.token = action.payload.token
      localStorage.setItem('cnms_token', action.payload.token)
    },
    logout: (state) => {
      disconnectSocket()
      state.user = null
      state.token = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.error = null

      localStorage.removeItem('cnms_token')
      localStorage.removeItem('cnms_refresh_token')
      localStorage.removeItem('cnms_user')
    },
    clearError: (state) => {
      state.error = null
    },
  },
})

export const { loginStart, loginSuccess, loginFailure, tokenRefreshed, logout, clearError, updateUser } =
  authSlice.actions
export default authSlice.reducer