import React from 'react'
import authService from '../../services/authService'
import RecoveryForm from './RecoveryForm'

export default function ForgotPasswordPage() {
  return (
    <RecoveryForm
      title="Forgot password"
      intro="Enter your college email or the phone number registered with the college. We'll email a reset link to the address on record."
      buttonLabel="Send reset link"
      doneText="If we found a matching account, a password reset link has been sent to the email address on record. The link is valid for 1 hour."
      onSubmit={(identifier) => authService.forgotPassword(identifier)}
    />
  )
}