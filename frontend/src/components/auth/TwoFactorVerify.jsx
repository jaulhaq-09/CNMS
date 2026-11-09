import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { loginSuccess } from '../../store/authSlice'
import authService from '../../services/authService'

export default function TwoFactorVerify() {
  const [otpCode, setOtpCode] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const challengeToken = location.state?.challengeToken

  if (!challengeToken) {
    navigate('/login')
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await authService.verify2FA(challengeToken, otpCode)
      const { user, token, refreshToken } = res.data.data
      dispatch(loginSuccess({ user, token, refreshToken }))
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
        Enter the 6-digit code from your authenticator app, or a backup code.
      </p>

      {error && (
        <div style={{ background: '#fee', color: '#c33', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <input
        type="text"
        value={otpCode}
        onChange={(e) => setOtpCode(e.target.value)}
        required
        placeholder="123456"
        maxLength={8}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '6px',
          border: '1px solid #ddd',
          fontSize: '20px',
          textAlign: 'center',
          letterSpacing: '4px',
          marginBottom: '20px',
        }}
      />

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
        {loading ? 'Verifying...' : 'Verify'}
      </button>
    </form>
  )
}