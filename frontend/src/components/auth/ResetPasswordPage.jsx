import React, { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import authService from '../../services/authService'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await authService.resetPassword(token, newPassword)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed — link may have expired')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#c33', fontSize: '14px' }}>Invalid or missing reset link.</p>
        <Link to="/forgot-password" style={{ color: '#667eea' }}>Request a new one</Link>
      </div>
    )
  }

  if (success) {
    return <p style={{ textAlign: 'center', fontSize: '14px', color: '#333' }}>Password reset! Redirecting to login...</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{ background: '#fee', color: '#c33', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>New Password</label>
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        minLength={8}
        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', marginBottom: '8px' }}
      />
      <p style={{ fontSize: '12px', color: '#667085', marginBottom: '20px' }}>
        At least 8 characters with an uppercase letter, a lowercase letter and a number.
      </p>
      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  )
}