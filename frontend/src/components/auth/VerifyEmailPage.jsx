import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import authService from '../../services/authService'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState('verifying') // verifying | success | error | pending

  useEffect(() => {
    if (!token) {
      setStatus('pending')
      return
    }

    authService
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])

  if (status === 'pending') {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: '#333' }}>
          Check your inbox for a verification email to activate your account.
        </p>
        <Link to="/login" style={{ color: '#667eea', fontSize: '14px' }}>Back to login</Link>
      </div>
    )
  }

  if (status === 'verifying') {
    return <p style={{ textAlign: 'center', fontSize: '14px' }}>Verifying your email...</p>
  }

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: '#3c3' }}>✅ Email verified! You can now log in.</p>
        <Link to="/login" style={{ color: '#667eea', fontWeight: 600 }}>Go to login</Link>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '14px', color: '#c33' }}>Verification link is invalid or expired.</p>
      <Link to="/login" style={{ color: '#667eea' }}>Back to login</Link>
    </div>
  )
}