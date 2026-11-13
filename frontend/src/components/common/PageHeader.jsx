import React from 'react'

export default function PageHeader({ title, description, children }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1B2340]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-[#667085]">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {children}
        </div>
      )}
    </div>
  )
}
