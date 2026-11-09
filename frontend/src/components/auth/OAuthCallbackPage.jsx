import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { loginSuccess, loginFailure } from '../../store/authSlice'
import api from '../../services/api'

export default function OAuthCallbackPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    completeOAuthLogin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const completeOAuthLogin = async () => {
    const accessToken = searchParams.get('accessToken')
    const refreshToken = searchParams.get('refreshToken')

    if (!accessToken) {
      setError('Google sign-in did not return a valid token.')
      setTimeout(() => navigate('/login'), 2000)
      return
    }

    try {
      // Store the token first so api.js's request interceptor picks it
      // up and attaches it to the /me call below — same mechanism every
      // other authenticated request already relies on.
      localStorage.setItem('cnms_token', accessToken)

      const { data: response } = await api.get('/api/auth/me')
      const user = response.data

      dispatch(
        loginSuccess({
          user,
          token: accessToken,
          refreshToken,
        })
      )

      navigate('/dashboard')
    } catch (err) {
      localStorage.removeItem('cnms_token')
      const message =
        err.response?.data?.message || 'Google sign-in failed. Please try again.'
      dispatch(loginFailure(message))
      setError(message)
      setTimeout(() => navigate('/login'), 2000)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto text-center">
      {error ? (
        <>
          <p className="text-red-600 text-sm mb-2">{error}</p>
          <p className="text-gray-500 text-sm">Redirecting you back to sign in...</p>
        </>
      ) : (
        <p className="text-gray-500 text-sm">Signing you in with Google...</p>
      )}
    </div>
  )
}