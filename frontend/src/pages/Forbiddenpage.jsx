import React from 'react'
import { Link } from 'react-router-dom'

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] px-6">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 rounded-full bg-[#1B2340] text-[#C9962C] flex items-center justify-center mx-auto mb-6 text-2xl font-serif font-semibold">
          !
        </div>
        <h1 className="font-serif font-semibold text-3xl text-[#1B2340] mb-3">
          Access restricted
        </h1>
        <p className="text-[#667085] mb-8">
          Your role doesn&apos;t have permission to view this page. If you think
          this is a mistake, reach out to your department coordinator or system
          admin.
        </p>
        <Link
          to="/dashboard"
          className="inline-block px-5 py-2.5 rounded-md bg-[#1B2340] text-white text-sm font-medium hover:bg-[#242b52] transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}