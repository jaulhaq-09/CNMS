import React, { useState } from 'react'
import EventForm from '../components/events/EventForm'
import { Link } from 'react-router-dom'

export default function PostEventPage() {
  const [justPosted, setJustPosted] = useState(null)

  return (
    <div className="space-y-6">
      <Link to="/post" className="inline-flex items-center gap-1 text-sm text-[#667085] hover:text-[#C9962C] transition-colors">
        ← Back to Post
      </Link>
      <div>
        <h2 className="font-serif font-semibold text-2xl text-[#1B2340]">Post an event</h2>
        <p className="text-sm text-[#667085] mt-1">
          Your department is set from your account. Your department&apos;s coordinators are
          notified by email and in the app as soon as you post.
        </p>
      </div>

      {justPosted && (
        <div className="bg-[#E7F3ED] border border-[#2E7D5B]/20 text-[#2E7D5B] text-sm rounded-lg px-4 py-3">
        "{justPosted.eventName}" was posted and sent to your department&apos;s coordinators for approval.
        </div>
      )}

      <EventForm onPosted={setJustPosted} />
    </div>
  )
}