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
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="flex justify-center mb-4">
            <img
              src={collegeLogo}
              alt="ProjectFlow Crest"
              className="w-16 h-16 rounded-full object-cover shadow-sm border border-indigo-100"
            />
          </div>

          <h1 className="font-serif text-2xl font-bold text-[#353086] tracking-tight">
            ProjectFlow
          </h1>
          <p className="text-gray-400 text-sm mt-0.5 mb-6">Login to continue</p>

          <div className="text-left text-sm font-semibold text-gray-700 mb-3">
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
                  className="w-full py-3 px-4 rounded-md bg-[#4338CA] hover:bg-[#3730A3] active:bg-[#312E81] text-white font-bold text-sm tracking-widest uppercase transition-all shadow-sm hover:shadow disabled:opacity-60 flex items-center justify-center cursor-pointer"
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

        <Link
          to="/"
          className="block text-center text-sm text-gray-500 hover:text-gray-800 mt-6 transition-colors"
        >
          Back to home
        </Link>
      </div>
    )
  }

  // --- Normal email & password sign-in form ---
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <img
          src={collegeLogo}
          alt="ProjectFlow"
          className="w-10 h-10 rounded-full object-cover ring-2 ring-[#4338CA]/30"
        />
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1B2340]">ProjectFlow</h1>
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
          <label className="block text-sm font-medium text-[#344054] mb-1.5">
            College email
          </label>
          <input
            type="email"
            name="email"
            required
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            className="w-full rounded-md border border-[#D0D5DD] px-3 py-2.5 text-sm text-[#1B2340] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#4338CA]/40 focus:border-[#4338CA] transition-colors"
            placeholder="yourname@bmsit.in"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#344054] mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              className="w-full rounded-md border border-[#D0D5DD] pl-3 pr-10 py-2.5 text-sm text-[#1B2340] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#4338CA]/40 focus:border-[#4338CA] transition-colors"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#1B2340] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <div className="flex justify-between">
          <Link to="/forgot-username" className="text-sm text-[#667085] hover:text-[#4338CA] transition-colors">
            Forgot username?
          </Link>
          <Link to="/forgot-password" className="text-sm text-[#667085] hover:text-[#4338CA] transition-colors">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[#4338CA] text-white py-2.5 text-sm font-semibold hover:bg-[#3730A3] hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none transition-all cursor-pointer"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-xs text-[#98A2B3] mt-7 text-center">
        Accounts are created by your college administrator.
        <br />
        Your username is your college email.
      </p>

      <Link
        to="/"
        className="block text-center text-sm text-gray-500 hover:text-gray-800 mt-5 transition-colors"
      >
        Back to home
      </Link>
    </div>
  )
}