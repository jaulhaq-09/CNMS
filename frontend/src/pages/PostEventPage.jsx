import React, { useState } from 'react'
import EventForm from '../components/events/EventForm'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'

export default function PostEventPage() {
  const [justPosted, setJustPosted] = useState(null)

  return (
    <div className="space-y-6">
      <Link to="/post" className="inline-flex items-center gap-1 text-sm text-[#667085] hover:text-[#C9962C] transition-colors">
        ← Back to Post
      </Link>
      <PageHeader
        title="Post an event"
        description="Your department is set from your account. Your department's coordinators are notified by email and in the app as soon as you post."
      />

      {justPosted && (
        <div className="bg-[#E7F3ED] border border-[#2E7D5B]/20 text-[#2E7D5B] text-sm rounded-lg px-4 py-3">
        "{justPosted.eventName}" was posted and sent to your department&apos;s coordinators for approval.
        </div>
      )}

      <EventForm onPosted={setJustPosted} />
    </div>
  )
}