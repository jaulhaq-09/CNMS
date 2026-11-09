import React from 'react'
import authService from '../../services/authService'
import RecoveryForm from './RecoveryForm'

export default function ForgotUsernamePage() {
  return (
    <RecoveryForm
      title="Forgot username"
      intro="Your username is your college email. Enter the phone number registered with the college and we'll email your username to the address on record."
      buttonLabel="Email my username"
      doneText="If we found a matching account, your username has been sent to the email address on record."
      onSubmit={(identifier) => authService.forgotUsername(identifier)}
    />
  )
}