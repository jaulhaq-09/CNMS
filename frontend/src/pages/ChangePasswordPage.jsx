import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { logout } from '../store/authSlice'
import api from '../services/api'

const RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'A number', test: (p) => /\d/.test(p) },
]

const inputCls =
  'w-full rounded-md border border-[#D0D5DD] pl-3 pr-10 py-2.5 text-sm text-[#1B2340] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/40 focus:border-[#C9962C] transition-colors'

export default function ChangePasswordPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }))
  const allRulesOk = RULES.every((r) => r.test(form.newPassword))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!allRulesOk) return setError('Your new password does not meet all the rules below.')
    if (form.newPassword !== form.confirm) return setError('The two new passwords do not match.')
    if (form.newPassword === form.currentPassword) return setError('Choose a password different from the temporary one.')

    setBusy(true)
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      toast.success('Password updated. Please sign in with your new password.')
      dispatch(logout())
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the password.')
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = () => {
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-8">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-[#C9962C]/10 flex items-center justify-center">
          <ShieldCheck size={24} className="text-[#C9962C]" />
        </div>
        <h1 className="font-serif text-2xl font-semibold text-[#1B2340] text-center">Set your own password</h1>
        <p className="text-sm text-[#667085] text-center mt-1.5 mb-6">
          {user?.firstName ? `Welcome, ${user.firstName}. ` : ''}
          You signed in with a temporary password. Choose a new one to continue.
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#344054] mb-1.5">Temporary password</label>
            <input
              type={show ? 'text' : 'password'}
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              required
              autoComplete="current-password"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#344054] mb-1.5">New password</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className={inputCls}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShow((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#1B2340]"
                aria-label={show ? 'Hide passwords' : 'Show passwords'}
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {RULES.map((r) => (
                <li key={r.label} className={`text-xs ${r.test(form.newPassword) ? 'text-green-600' : 'text-[#98A2B3]'}`}>
                  {r.test(form.newPassword) ? '✓' : '○'} {r.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#344054] mb-1.5">Confirm new password</label>
            <input
              type={show ? 'text' : 'password'}
              name="confirm"
              value={form.confirm}
              onChange={handleChange}
              required
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-[#1B2340] text-white py-2.5 text-sm font-semibold hover:bg-[#242b52] disabled:opacity-50 transition-colors"
          >
            {busy ? 'Saving…' : 'Save and continue'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="w-full text-sm text-[#667085] hover:text-[#1B2340] transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}