import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import PatentEntryForm from '../components/patents/PatentEntryForm'
import PageHeader from '../components/common/PageHeader'

export default function PostPatentPage() {
  const [justPosted, setJustPosted] = useState(null)

  return (
    <div className="space-y-6">
      <Link
        to="/post"
        className="inline-flex items-center gap-1 text-sm text-[#667085] hover:text-[#C9962C] transition-colors"
      >
        ← Back to Post
      </Link>
      <PageHeader
        title="Submit a patent"
        description="Applied, published, or granted patents — reviewed by your coordinator before inclusion in the newsletter."
      />

      {justPosted && (
        <div className="bg-[#E7F3ED] border border-[#2E7D5B]/20 text-[#2E7D5B] text-sm rounded-lg px-4 py-3 animate-[fadeInUp_0.2s_ease-out]">
          &quot;{justPosted.title}&quot; was submitted and is awaiting review.
        </div>
      )}

      <PatentEntryForm onPosted={setJustPosted} />
    </div>
  )
}