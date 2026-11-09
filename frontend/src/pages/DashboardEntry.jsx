import React from 'react'
import { useSelector } from 'react-redux'
import { Hourglass } from 'lucide-react'
import DashboardHome from './DashboardHome'

function GuestWelcome({ user }) {
  return (
    <div className="max-w-xl mx-auto mt-16 text-center bg-white border border-[#E4E7EC] rounded-xl p-10 shadow-sm">
      <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-[#C9962C]/10 flex items-center justify-center">
        <Hourglass size={26} className="text-[#C9962C]" />
      </div>
      <h1 className="font-serif text-2xl font-semibold text-[#1B2340] mb-2">
        Welcome{user?.firstName ? `, ${user.firstName}` : ''}
      </h1>
      <p className="text-[#667085] text-sm leading-relaxed">
        Your account is active, but the administrator has not assigned your role yet.
        Once your role is set, the full application will open up here automatically.
      </p>
      <p className="text-xs text-[#98A2B3] mt-6">
        Need access sooner? Contact your college administrator.
      </p>
    </div>
  )
}

export default function DashboardEntry() {
  const user = useSelector((state) => state.auth.user)
  if (user?.role === 'GUEST') return <GuestWelcome user={user} />
  return <DashboardHome />
}