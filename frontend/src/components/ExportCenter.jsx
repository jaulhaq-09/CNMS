import React, { useState } from 'react'
import ExportOptions from './ExportOptions'

const EXPORT_TYPES = [
  { id: 'events', label: 'Events' },
  { id: 'newsletters', label: 'Newsletters' },
  { id: 'publications', label: 'Publications' },
  { id: 'patents', label: 'Patents' },
  { id: 'facultyAchievements', label: 'Achievements' },
  { id: 'nptelCourses', label: 'NPTEL Courses' },
]

export default function ExportCenter() {
  const [exportType, setExportType] = useState('events')
  const [loading, setLoading] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif font-semibold text-2xl text-[#1B2340]">Export Data</h2>
        <p className="text-sm text-[#667085] mt-1">
          Export your events, newsletters, and more in multiple formats
        </p>
      </div>

      <div className="flex gap-2">
        {EXPORT_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => setExportType(type.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${exportType === type.id
                ? 'bg-[#1B2340] text-white'
                : 'bg-white border border-[#E4E7EC] text-[#667085] hover:border-[#C9962C]/40'
              }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <ExportOptions exportType={exportType} onLoading={setLoading} loading={loading} />
    </div>
  )
}