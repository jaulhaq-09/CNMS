import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

export default function RegistrationInfoPage() {
  return (
    <div className="mx-auto w-full max-w-sm text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C9962C]/10 text-[#8F6317]">
        <ShieldCheck size={28} aria-hidden="true" />
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8F6317]">
        Account access
      </p>
      <h1 className="font-serif text-2xl font-bold tracking-tight text-[#1B2340]">
        Registration is managed by your college
      </h1>
      <p className="mt-3 text-sm leading-6 text-[#667085]">
        CNMS accounts are created by your college administrator to ensure each
        account has the correct role and department. Please contact your
        administrator to request access.
      </p>
      <Link
        to="/login"
        className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-[#1B2340] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#29345A] focus:outline-none focus:ring-2 focus:ring-[#C9962C] focus:ring-offset-2"
      >
        Go to sign in
      </Link>
    </div>
  )
}
