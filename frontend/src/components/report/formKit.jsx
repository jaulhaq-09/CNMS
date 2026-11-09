import React from 'react'

export const inputClass = (hasError) =>
  `w-full px-3 py-2 rounded-md border text-sm text-[#1B2340] placeholder:text-[#98A2B3] bg-white focus:outline-none transition-colors ${
    hasError ? 'border-[#F04438] focus:border-[#F04438]' : 'border-[#E4E7EC] focus:border-[#C9962C]'
  }`

export function Field({ label, htmlFor, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[#1B2340] mb-1.5">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-[#B42318] mt-1">{error}</p>
      ) : (
        hint && <p className="text-xs text-[#98A2B3] mt-1">{hint}</p>
      )}
    </div>
  )
}

export function Section({ title, subtitle, children }) {
  return (
    <section className="border border-[#E4E7EC] rounded-lg p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[#1B2340]">{title}</h3>
        {subtitle && <p className="text-xs text-[#667085] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}