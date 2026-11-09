/**
 * Shared date formatting helpers.
 *
 * These intentionally use the browser's default locale formatting (no
 * explicit options) to match the exact output every component was
 * already producing inline via `new Date(x).toLocaleDateString()` /
 * `.toLocaleString()` — swapping to these helpers should not change
 * anything visually.
 */

export function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString()
}

export function formatDateTime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleString()
}

export function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return '—'
  if (startDate && !endDate) return formatDate(startDate)
  if (!startDate && endDate) return formatDate(endDate)
  return `${formatDate(startDate)} – ${formatDate(endDate)}`
}

// Matches the exact thresholds/output previously hardcoded inside
// NotificationList.jsx's local formatTime() — seconds -> minutes ->
// hours -> days -> falls back to a plain date after a week.
export function formatRelativeTime(date) {
  if (!date) return '—'
  const now = new Date()
  const diff = now - new Date(date)
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return formatDate(date)
}

// Matches SearchResults.jsx's toDateString() usage — a different, more
// verbose format than formatDate's toLocaleDateString().
export function formatDateVerbose(date) {
  if (!date) return '—'
  return new Date(date).toDateString()
}

// Matches the identical todayLine() previously duplicated in both
// DashboardHome.jsx and DashboardLayout.jsx. Defaults to "now" so
// existing no-argument call sites (`todayLine()`) keep working as
// `formatDateLong()`.
export function formatDateLong(date = new Date()) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Matches DashboardHome.jsx's local timeAgo() exactly — same thresholds
// as formatRelativeTime, but a different empty-input guard ('' instead
// of '—') and a shorter fallback date format once past a week.
export function formatRelativeTimeCompact(date) {
  if (!date) return ''
  const now = new Date()
  const diffMs = now - new Date(date)
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}