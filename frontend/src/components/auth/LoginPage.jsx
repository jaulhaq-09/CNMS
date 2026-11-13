import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { loginStart, loginSuccess, loginFailure } from '../../store/authSlice'
import api from '../../services/api'
import collegeLogo from '../../assets/college-logo.jpg'

const ROLE_DISPLAY_NAMES = {
  SUPER_ADMIN: 'ADMIN',
  ADMIN: 'ADMIN',
  COORDINATOR: 'COORDINATOR',
  FACULTY: 'FACULTY',
}

export default function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [roleLoading, setRoleLoading] = useState(null)
  const [localError, setLocalError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [roleSelection, setRoleSelection] = useState(null)

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const completeLogin = (payload) => {
    dispatch(
      loginSuccess({
        user: payload.user,
        token: payload.token,
        refreshToken: payload.refreshToken,
      })
    )
    navigate('/dashboard')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')
    setLoading(true)
    dispatch(loginStart())

    try {
      const { data: response } = await api.post('/api/auth/login', form)
      const payload = response.data

      if (payload.requiresTwoFactor) {
        navigate('/verify-2fa', { state: { challengeToken: payload.challengeToken } })
        return
      }

      if (payload.requiresRoleSelection) {
        setRoleSelection({
          email: form.email,
          password: form.password,
          availableRoles: payload.availableRoles || ['FACULTY'],
        })
        return
      }

      completeLogin(payload)
    } catch (err) {
      const message =
        err.response?.data?.message || 'Login failed. Please check your credentials.'
      dispatch(loginFailure(message))
      setLocalError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleSelect = async (role) => {
    if (!roleSelection) return
    setRoleLoading(role)
    setLocalError('')

    try {
      const { data: response } = await api.post('/api/auth/login', {
        email: roleSelection.email,
        password: roleSelection.password,
        selectedRole: role,
      })
      const payload = response.data

      if (payload.requiresTwoFactor) {
        navigate('/verify-2fa', { state: { challengeToken: payload.challengeToken } })
        return
      }

      completeLogin(payload)
    } catch (err) {
      const message =
        err.response?.data?.message || 'Login failed. Please select your role again.'
      setLocalError(message)
    } finally {
      setRoleLoading(null)
    }
  }

  // --- Role selection view (Matches Screenshot 1) ---
  if (roleSelection) {
    const rawRoles = Array.isArray(roleSelection.availableRoles) && roleSelection.availableRoles.length > 0
      ? roleSelection.availableRoles
      : ['FACULTY']
    const validKeys = ['SUPER_ADMIN', 'ADMIN', 'COORDINATOR', 'FACULTY']
    const roles = rawRoles.filter((r) => validKeys.includes(r))
    if (roles.length === 0) roles.push('FACULTY')

    return (
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src={collegeLogo}
              alt="BMS Institute of Technology and Management crest"
              className="w-16 h-16 rounded-full object-cover shadow-sm border border-[#C9962C]/30"
            />
          </div>

          <h1 className="font-serif text-2xl font-bold text-[#1B2340] tracking-tight">
            CNMS
          </h1>
          <p className="text-[#667085] text-sm mt-0.5 mb-6">Choose an account role to continue</p>

          <div className="text-left text-sm font-semibold text-[#344054] mb-3">
            Continue as:
          </div>

          {localError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 text-left">
              {localError}
            </div>
          )}

          <div className="space-y-3">
            {roles.map((role) => {
              const displayLabel = ROLE_DISPLAY_NAMES[role] || role
              const isSelected = roleLoading === role

              return (
                <button
                  key={role}
                  type="button"
                  disabled={!!roleLoading}
                  onClick={() => handleRoleSelect(role)}
                  className="w-full py-3 px-4 rounded-lg bg-[#1B2340] hover:bg-[#29345A] active:bg-[#151B31] text-white font-semibold text-sm tracking-wide uppercase transition-all shadow-sm hover:shadow disabled:opacity-60 flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C9962C] focus:ring-offset-2"
                >
                  {isSelected ? 'Signing in…' : displayLabel}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setRoleSelection(null)
              setLocalError('')
            }}
            className="w-full text-center text-sm font-medium text-gray-500 hover:text-gray-800 py-2 mt-3 transition-colors cursor-pointer"
          >
            Back
          </button>
        </div>

      </div>
    )
  }

  // --- Normal email & password sign-in form ---
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <img
          src={collegeLogo}
          alt="BMS Institute of Technology and Management crest"
          className="w-10 h-10 rounded-full object-cover ring-2 ring-[#C9962C]/40"
        />
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1B2340]">CNMS</h1>
          <p className="text-[#667085] text-xs">College Newsletter Management System</p>
        </div>
      </div>

      <h2 className="font-serif text-xl font-semibold text-[#1B2340] mb-1">Sign in</h2>
      <p className="text-[#667085] text-sm mb-6">Login to continue to your account.</p>

      {localError && (
        <div className="mb-5 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">
          {localError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-[#344054] mb-1.5">
            College email
          </label>
          <input
            id="login-email"
            type="email"
            name="email"
            required
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm text-[#1B2340] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/50 focus:border-[#C9962C] transition-colors"
            placeholder="yourname@bmsit.in"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-[#344054] mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              className="w-full rounded-lg border border-[#D0D5DD] pl-3 pr-10 py-2.5 text-sm text-[#1B2340] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/50 focus:border-[#C9962C] transition-colors"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#98A2B3] hover:text-[#1B2340] focus:outline-none focus:ring-2 focus:ring-[#C9962C] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Link to="/forgot-username" className="text-sm text-[#667085] hover:text-[#8F6317] transition-colors">
            Forgot username?
          </Link>
          <Link to="/forgot-password" className="text-sm text-[#667085] hover:text-[#8F6317] transition-colors">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#1B2340] text-white py-2.5 text-sm font-semibold hover:bg-[#29345A] hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#C9962C] focus:ring-offset-2 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none transition-all cursor-pointer"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 border-t border-[#EAECF0] pt-5 text-center">
        <p className="text-xs leading-5 text-[#667085]">
          Accounts are created by your college administrator. Your username is your college email.
        </p>
        <Link
          to="/register"
          className="mt-2 inline-block text-sm font-semibold text-[#8F6317] hover:text-[#6F4B10] focus:outline-none focus:underline"
        >
          Need an account? Request access
        </Link>
      </div>

    </div>
  )
}