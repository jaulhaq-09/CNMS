import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  SlidersHorizontal,
  Calendar,
  Newspaper,
  FileText,
  BookOpen,
  Lightbulb,
  Award,
  GraduationCap,
  Clock,
  Loader2,
  CornerDownLeft,
} from 'lucide-react'
import searchService from '../../services/searchService'
import { formatDate, formatDateVerbose } from '../../utils/date'

const RECENT_KEY = 'cnms_recent_searches'
const MAX_RECENT = 5

const STATUS_STYLES = {
  DRAFT: 'bg-[#F2F4F7] text-[#667085]',
  SUBMITTED: 'bg-[#FBF3E7] text-[#B07C1F]',
  UNDER_REVIEW: 'bg-[#FBF3E7] text-[#B07C1F]',
  APPROVED: 'bg-[#ECFDF3] text-[#067647]',
  REJECTED: 'bg-[#FEF3F2] text-[#B42318]',
  PUBLISHED: 'bg-[#EFF4FF] text-[#1B2340]',
  ACTIVE: 'bg-[#ECFDF3] text-[#067647]',
  SCHEDULED: 'bg-[#FBF3E7] text-[#B07C1F]',
}

const join = (...parts) => parts.filter(Boolean).join(' · ')
const safeDate = (fn, value) => {
  try {
    return value ? fn(value) : ''
  } catch {
    return ''
  }
}

// Which result groups exist, how to show them, and where (if anywhere) they open.
// Only events, publications and NPTEL courses have a page to open; the rest are
// shown for lookup only, same as the old search page.
const GROUPS = [
  {
    key: 'events',
    label: 'Events',
    icon: Calendar,
    map: (e) => ({
      title: e.eventName,
      description: e.description,
      meta: join(safeDate(formatDateVerbose, e.eventDate), e.location),
      status: e.status,
      to: `/events/${e._id}`,
    }),
  },
  {
    key: 'publications',
    label: 'Publications',
    icon: BookOpen,
    map: (p) => ({
      title: p.title,
      description: p.authors?.join(', '),
      meta: p.venueName,
      status: p.status,
      to: `/publications/${p._id}`,
    }),
  },
  {
    key: 'newsletters',
    label: 'Newsletters',
    icon: Newspaper,
    map: (n) => ({
      title: n.name,
      description: n.description,
      meta: safeDate(formatDateVerbose, n.createdAt),
      status: n.status,
    }),
  },
  {
    key: 'templates',
    label: 'Templates',
    icon: FileText,
    map: (t) => ({
      title: t.name,
      description: t.description,
      meta: t.category,
      status: t.status,
    }),
  },
  {
    key: 'patents',
    label: 'Patents',
    icon: Lightbulb,
    map: (p) => ({
      title: p.title,
      description: p.inventors?.join(', '),
      meta: join(p.grantStatus, p.grantingAuthority),
      status: p.status,
    }),
  },
  {
    key: 'achievements',
    label: 'Faculty achievements',
    icon: Award,
    map: (a) => ({
      title: a.title,
      description: a.description,
      meta: a.category,
      status: a.status,
    }),
  },
  {
    key: 'nptelCourses',
    label: 'NPTEL courses',
    icon: GraduationCap,
    map: (c) => ({
      title: c.courseName,
      description: c.faculty ? `${c.faculty.firstName} ${c.faculty.lastName}` : '',
      meta: join(
        c.platform || 'NPTEL',
        c.completionDate ? `Completed ${safeDate(formatDate, c.completionDate)}` : ''
      ),
      to: '/nptel-courses',
    }),
  },
]

const EMPTY_FILTERS = { status: '', eventType: '', dateFrom: '', dateTo: '' }

const selectClass =
  'w-full px-2.5 py-1.5 rounded-md border border-[#E4E7EC] text-sm bg-white text-[#1B2340] focus:outline-none focus:border-[#C9962C]'

function readRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeRecent(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable, ignore */
  }
}

export default function SearchModal({ open, onClose }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const requestId = useRef(0)

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState([])

  // Fresh start every time the box opens.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setFilters(EMPTY_FILTERS)
    setShowFilters(false)
    setResults(null)
    setError('')
    setActive(0)
    setRecent(readRecent())
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  // Esc closes.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock page scroll behind the box.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Live search, debounced. Stale responses are ignored.
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      requestId.current += 1
      setResults(null)
      setLoading(false)
      setError('')
      return
    }

    const id = ++requestId.current
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
        const res = await searchService.globalSearch(q, params, 1, 4)
        if (id !== requestId.current) return
        setResults(res)
        setError('')
        setActive(0)
      } catch (err) {
        if (id !== requestId.current) return
        setResults(null)
        setError(err.response?.data?.message || err.message || 'Search failed')
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query, filters, open])

  const sections = useMemo(() => {
    const data = results?.data || {}
    return GROUPS.map((g) => ({
      ...g,
      items: (data[g.key] || []).map((raw) => ({ id: raw._id, ...g.map(raw) })),
    })).filter((g) => g.items.length > 0)
  }, [results])

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections])

  // Keep the highlighted row visible while arrowing through results.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, flat])

  if (!open) return null

  const activeFilterCount = Object.values(filters).filter(Boolean).length
  const trimmed = query.trim()

  const remember = (term) => {
    if (!term) return
    const next = [term, ...readRecent().filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(
      0,
      MAX_RECENT
    )
    writeRecent(next)
  }

  const choose = (item) => {
    if (!item?.to) return
    remember(trimmed)
    onClose()
    navigate(item.to)
  }

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flat.length) setActive((i) => (i + 1) % flat.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flat.length) setActive((i) => (i - 1 + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(flat[active])
    }
  }

  const clearRecent = () => {
    writeRecent([])
    setRecent([])
  }

  let rowIndex = -1

  return createPortal(
    <>
      <style>{`
        @keyframes searchFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes searchPop { from { opacity: 0; transform: translateY(-8px) scale(.985) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>

      <div
        className="fixed inset-0 z-50 bg-[#1B2340]/45 backdrop-blur-[2px] animate-[searchFade_0.15s_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="fixed z-50 left-1/2 top-[10vh] -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E4E7EC] overflow-hidden flex flex-col max-h-[78vh] animate-[searchPop_0.18s_ease-out]"
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[#E4E7EC] shrink-0">
          {loading ? (
            <Loader2 size={18} className="text-[#C9962C] animate-spin shrink-0" />
          ) : (
            <Search size={18} className="text-[#98A2B3] shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search events, publications, patents, courses…"
            aria-label="Search"
            className="flex-1 bg-transparent text-sm text-[#1B2340] placeholder:text-[#98A2B3] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="w-6 h-6 rounded-full flex items-center justify-center text-[#98A2B3] hover:bg-[#F5F6F8] hover:text-[#1B2340] transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              showFilters || activeFilterCount
                ? 'border-[#C9962C]/50 bg-[#C9962C]/10 text-[#B07C1F]'
                : 'border-[#E4E7EC] text-[#667085] hover:bg-[#F5F6F8]'
            }`}
          >
            <SlidersHorizontal size={13} />
            Filters
            {activeFilterCount > 0 && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#C9962C] text-[#1B2340] text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded border border-[#E4E7EC] text-[10px] text-[#98A2B3] font-sans">
            Esc
          </kbd>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-[#E4E7EC] bg-[#FAFAFB] shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[#98A2B3] font-semibold mb-1">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className={selectClass}
                >
                  <option value="">All</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[#98A2B3] font-semibold mb-1">
                  Event type
                </label>
                <select
                  value={filters.eventType}
                  onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                  className={selectClass}
                >
                  <option value="">All</option>
                  <option value="Conference">Conference</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Seminar">Seminar</option>
                  <option value="Sports">Sports</option>
                  <option value="Cultural">Cultural</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[#98A2B3] font-semibold mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className={selectClass}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[#98A2B3] font-semibold mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className={selectClass}
                />
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="mt-3 text-xs text-[#C9962C] font-medium hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {trimmed.length < 2 ? (
            recent.length > 0 ? (
              <div className="py-2">
                <div className="flex items-center justify-between px-4 pt-2 pb-1">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#98A2B3] font-semibold">
                    Recent searches
                  </p>
                  <button
                    type="button"
                    onClick={clearRecent}
                    className="text-[11px] text-[#98A2B3] hover:text-[#B42318] transition-colors"
                  >
                    Clear
                  </button>
                </div>
                {recent.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setQuery(term)
                      inputRef.current?.focus()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[#1B2340] hover:bg-[#F5F6F8] transition-colors"
                  >
                    <Clock size={14} className="text-[#98A2B3] shrink-0" />
                    <span className="truncate">{term}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <Search size={28} className="mx-auto text-[#D0D5DD] mb-3" />
                <p className="text-sm text-[#667085]">Type at least 2 characters to search.</p>
              </div>
            )
          ) : error ? (
            <div className="px-6 py-10 text-center text-sm text-[#B42318]">{error}</div>
          ) : loading && !results ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F2F4F7] animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/2 bg-[#F2F4F7] rounded animate-pulse" />
                    <div className="h-2.5 w-3/4 bg-[#F2F4F7] rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : sections.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-[#1B2340] font-medium">No results for “{trimmed}”</p>
              <p className="text-xs text-[#98A2B3] mt-1">
                Try a different word{activeFilterCount ? ' or clear your filters' : ''}.
              </p>
            </div>
          ) : (
            <div className={`py-2 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {sections.map((section) => {
                const Icon = section.icon
                return (
                  <div key={section.key} className="mb-1">
                    <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.15em] text-[#98A2B3] font-semibold">
                      {section.label}
                    </p>
                    {section.items.map((item) => {
                      rowIndex += 1
                      const idx = rowIndex
                      const isActive = idx === active
                      return (
                        <button
                          key={`${section.key}-${item.id}`}
                          type="button"
                          data-idx={idx}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => choose(item)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isActive ? 'bg-[#F5F6F8]' : ''
                          } ${item.to ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <span
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isActive ? 'bg-[#1B2340] text-white' : 'bg-[#F2F4F7] text-[#667085]'
                            }`}
                          >
                            <Icon size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#1B2340] truncate">
                                {item.title}
                              </span>
                              {item.status && (
                                <span
                                  className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                                    STATUS_STYLES[item.status] || 'bg-[#F2F4F7] text-[#667085]'
                                  }`}
                                >
                                  {item.status}
                                </span>
                              )}
                            </span>
                            {(item.description || item.meta) && (
                              <span className="block text-xs text-[#667085] truncate mt-0.5">
                                {item.description || item.meta}
                              </span>
                            )}
                            {item.description && item.meta && (
                              <span className="block text-[11px] text-[#98A2B3] truncate">
                                {item.meta}
                              </span>
                            )}
                          </span>
                          {isActive && item.to && (
                            <CornerDownLeft size={14} className="text-[#98A2B3] shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-2.5 border-t border-[#E4E7EC] bg-[#FAFAFB] text-[11px] text-[#98A2B3] shrink-0">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-[#E4E7EC] bg-white font-sans">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-[#E4E7EC] bg-white font-sans">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-[#E4E7EC] bg-white font-sans">↵</kbd>
            open
          </span>
          <span className="ml-auto">Tip: press Ctrl+K anywhere</span>
        </div>
      </div>
    </>,
    document.body
  )
}