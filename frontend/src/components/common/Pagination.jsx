import React from 'react'

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null

  const pages = []
  const maxButtons = 5
  let start = Math.max(1, currentPage - Math.floor(maxButtons / 2))
  let end = Math.min(totalPages, start + maxButtons - 1)
  start = Math.max(1, end - maxButtons + 1)

  for (let p = start; p <= end; p++) pages.push(p)

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="px-3 py-1.5 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Prev
      </button>

      {start > 1 && (
        <>
          <button
            type="button"
            onClick={() => onPageChange(1)}
            className="w-9 h-9 rounded-md text-sm text-[#667085] hover:bg-[#F5F6F8]"
          >
            1
          </button>
          {start > 2 && <span className="text-[#98A2B3] px-1">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          className={`w-9 h-9 rounded-md text-sm font-medium ${
            p === currentPage
              ? 'bg-[#1B2340] text-white'
              : 'text-[#667085] hover:bg-[#F5F6F8]'
          }`}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-[#98A2B3] px-1">…</span>}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            className="w-9 h-9 rounded-md text-sm text-[#667085] hover:bg-[#F5F6F8]"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="px-3 py-1.5 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  )
}