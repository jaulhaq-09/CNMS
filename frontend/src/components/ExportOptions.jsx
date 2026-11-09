import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import exportService from '../services/exportService'

const FORMATS = ['CSV', 'EXCEL', 'PDF']

const FORMAT_INFO = [
  { label: 'CSV', desc: 'Comma-separated values. Best for spreadsheets and data analysis.' },
  { label: 'EXCEL', desc: 'Microsoft Excel format. Opens directly with columns and rows.' },
  { label: 'PDF', desc: 'Portable Document Format. A print-ready report with a summary.' },
]

const EXT_MAP = { CSV: 'csv', EXCEL: 'xlsx', PDF: 'pdf' }

const TYPE_LABELS = {
  events: 'Events',
  newsletters: 'Newsletters',
  publications: 'Publications',
  patents: 'Patents',
  facultyAchievements: 'Achievements',
  nptelCourses: 'NPTEL Courses',
}

const EXPORTERS = {
  events: exportService.exportEvents,
  newsletters: exportService.exportNewsletters,
  publications: exportService.exportPublications,
  patents: exportService.exportPatents,
  facultyAchievements: exportService.exportFacultyAchievements,
  nptelCourses: exportService.exportNptelCourses,
}

// Downloads use responseType 'blob', so a failed request's error body is
// ALSO a Blob and err.response.data.message is always undefined. Read the
// blob as text and pull the real backend message out of it.
async function extractErrorMessage(err) {
  const data = err?.response?.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const parsed = JSON.parse(text)
      return parsed?.message || 'Export failed'
    } catch {
      return 'Export failed'
    }
  }
  return data?.message || err?.message || 'Export failed'
}

export default function ExportOptions({ exportType, onLoading, loading }) {
  const [filters, setFilters] = useState({})
  const [format, setFormat] = useState('CSV')
  const [error, setError] = useState(null)

  // Switching data type starts fresh, so a leftover status/date filter from
  // one tab doesn't silently apply to another.
  useEffect(() => {
    setFilters({})
    setError(null)
  }, [exportType])

  const hasActiveFilters = Object.values(filters).some(Boolean)
  const typeLabel = TYPE_LABELS[exportType] || 'Data'

  const handleExport = async () => {
    const exporter = EXPORTERS[exportType]
    if (!exporter) return

    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      const message = '"Date From" must be on or before "Date To".'
      setError(message)
      toast.error(message)
      return
    }

    try {
      onLoading(true)
      setError(null)

      const response = await exporter(filters, format)

      const today = new Date().toISOString().slice(0, 10)
      const filename = `${typeLabel.toLowerCase().replace(/\s+/g, '-')}_${today}.${EXT_MAP[format]}`
      exportService.downloadFile(response.data, filename)

      toast.success(`${typeLabel} exported as ${format}`)
    } catch (err) {
      const message = await extractErrorMessage(err)
      setError(message)
      toast.error(message)
    } finally {
      onLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="col-span-2 sm:col-span-4">
            <label className="block text-[11px] uppercase tracking-wide text-[#98A2B3] font-semibold mb-2">
              Format
            </label>
            <div className="flex gap-2">
              {FORMATS.map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${format === fmt
                    ? 'bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340]'
                    : 'bg-[#F5F6F8] text-[#667085] hover:bg-[#E4E7EC]'
                    }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {exportType !== 'nptelCourses' && (
            <div>
              <label
                htmlFor="export-status"
                className="block text-[11px] uppercase tracking-wide text-[#98A2B3] font-semibold mb-1"
              >
                Status
              </label>
              <select
                id="export-status"
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                className="w-full px-2.5 py-1.5 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
              >
                <option value="">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="export-date-from"
              className="block text-[11px] uppercase tracking-wide text-[#98A2B3] font-semibold mb-1"
            >
              Date From
            </label>
            <input
              id="export-date-from"
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
              className="w-full px-2.5 py-1.5 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
            />
          </div>

          <div>
            <label
              htmlFor="export-date-to"
              className="block text-[11px] uppercase tracking-wide text-[#98A2B3] font-semibold mb-1"
            >
              Date To
            </label>
            <input
              id="export-date-to"
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
              className="w-full px-2.5 py-1.5 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => setFilters({})}
            className="mt-3 text-xs text-[#C9962C] font-medium hover:underline"
          >
            Clear filters
          </button>
        )}

        <button
          onClick={handleExport}
          disabled={loading}
          className="mt-5 px-5 py-2.5 rounded-md bg-[#1B2340] text-white text-sm font-medium hover:bg-[#242b52] hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none"
        >
          {loading ? 'Exporting...' : `Export ${typeLabel} as ${format}`}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {FORMAT_INFO.map((f) => (
          <div key={f.label} className="bg-white border border-[#E4E7EC] rounded-lg p-4">
            <p className="text-xs font-semibold text-[#1B2340] mb-1">{f.label}</p>
            <p className="text-xs text-[#667085] leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}