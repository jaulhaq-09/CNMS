import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'

// Shared by "Forgot password" and "Forgot username".
// Always shows the same confirmation, so nobody can use it to find out
// which emails or phone numbers are registered.
export default function RecoveryForm({ title, intro, buttonLabel, doneText, onSubmit }) {
  const [identifier, setIdentifier] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSubmit(identifier.trim())
      setSent(true)
    } catch (err) {
      // Only rate-limit / network problems reach here (the server never says "not found").
      setError(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm mx-auto text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-50 flex items-center justify-center">
          <MailCheck size={24} className="text-green-600" />
        </div>
        <h1 className="font-serif text-2xl font-semibold text-[#1B2340] mb-2">Check your email</h1>
        <p className="text-sm text-[#667085] mb-6">{doneText}</p>
        <Link to="/login" className="text-sm font-semibold text-[#1B2340] hover:text-[#C9962C] transition-colors">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <h1 className="font-serif text-2xl font-semibold text-[#1B2340] mb-1">{title}</h1>
      <p className="text-[#667085] text-sm mb-7">{intro}</p>

      {error && (
        <div className="mb-5 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#344054] mb-1.5">College email or phone number</label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            maxLength={120}
            autoComplete="username"
            placeholder="yourname@bmsit.in or 98xxxxxxxx"
            className="w-full rounded-md border border-[#D0D5DD] px-3 py-2.5 text-sm text-[#1B2340] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/40 focus:border-[#C9962C] transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[#1B2340] text-white py-2.5 text-sm font-semibold hover:bg-[#242b52] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Sending…' : buttonLabel}
        </button>
      </form>

      <p className="text-sm text-[#667085] mt-7 text-center">
        <Link to="/login" className="font-semibold text-[#1B2340] hover:text-[#C9962C] transition-colors">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}