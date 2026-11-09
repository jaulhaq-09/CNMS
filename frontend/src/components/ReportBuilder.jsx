import React, { useState } from 'react'
import toast from 'react-hot-toast'
import reportService from '../services/reportService'

const REPORT_TYPES = [
  {
    id: 'EVENTS',
    label: 'Events Report',
    desc: 'Every event in the selected period — status, department, organizer, and dates.',
  },
  {
    id: 'NEWSLETTERS',
    label: 'Newsletters Report',
    desc: 'Which newsletters were compiled and published, with their delivery numbers.',
  },
  {
    id: 'PUBLICATIONS',
    label: 'Publications Report',
    desc: 'Journal and conference papers, book chapters and books — authors, venue, indexing and status.',
  },
  {
    id: 'PATENTS',
    label: 'Patents Report',
    desc: 'Patents filed and granted — inventors, patent number, granting authority and dates.',
  },
  {
    id: 'ACHIEVEMENTS',
    label: 'Faculty Achievements Report',
    desc: 'Awards, recognitions and other faculty achievements — category, awarding body and date.',
  },
  {
    id: 'NPTEL',
    label: 'NPTEL Courses Report',
    desc: 'NPTEL courses taken by faculty — platform, duration, completion date and certificate.',
  },
]
const FORMAT_DESCRIPTIONS = {
  PDF: 'A print-ready document — best for sharing with people outside the system or archiving.',
  EXCEL: 'A spreadsheet with raw rows — best if someone needs to filter, sort, or chart the data themselves.',
  CSV: 'A plain data file — best for importing into another system or tool.',
}

const EMPTY_REPORT = {
  name: '',
  description: '',
  type: 'EVENTS',
  format: 'PDF',
  columns: [],
  metrics: [],
  filters: {},
  settings: {
    includeCharts: true,
    includeSummary: true,
    pageOrientation: 'portrait',
  },
}

function formatPickedDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
export default function ReportBuilder({ onSave }) {
  const [report, setReport] = useState(EMPTY_REPORT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async () => {
    try {
      if (!report.name.trim()) {
        setError('Report name is required')
        return
      }

      const { dateFrom, dateTo } = report.filters || {}
      if (dateFrom && dateTo && dateFrom > dateTo) {
        setError('"From" date must be on or before the "To" date')
        return
      }

      setLoading(true)
      setError(null)

      // Dates are sent as full timestamps in the user's own timezone, so the
      // "To" day is included right up to its last millisecond.
      const filters = {}
      if (dateFrom) filters.dateFrom = new Date(`${dateFrom}T00:00:00`).toISOString()
      if (dateTo) filters.dateTo = new Date(`${dateTo}T23:59:59.999`).toISOString()

      const response = await reportService.create({ ...report, filters })

      toast.success('Report created')
      setReport(EMPTY_REPORT)

      if (onSave) onSave(response.data)
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create report'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const selectedType = REPORT_TYPES.find((t) => t.id === report.type)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
      {/* Form */}
      <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
        <h2 className="font-serif font-semibold text-lg text-[#1B2340]">Build Custom Report</h2>

        {error && (
          <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="report-name" className="block text-sm font-medium text-[#1B2340] mb-1.5">
            Report Name
          </label>
          <input
            id="report-name"
            type="text"
            value={report.name}
            onChange={(e) => setReport({ ...report, name: e.target.value })}
            placeholder="My Monthly Report"
            className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
          />
        </div>

        <div>
          <label htmlFor="report-description" className="block text-sm font-medium text-[#1B2340] mb-1.5">
            Description
          </label>
          <textarea
            id="report-description"
            rows={3}
            value={report.description}
            onChange={(e) => setReport({ ...report, description: e.target.value })}
            placeholder="Add a description for this report"
            className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="report-type" className="block text-sm font-medium text-[#1B2340] mb-1.5">
              Report Type
            </label>
            <select
              id="report-type"
              value={report.type}
              onChange={(e) => setReport({ ...report, type: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
            >
              {REPORT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-format" className="block text-sm font-medium text-[#1B2340] mb-1.5">
              Format
            </label>
            <select
              id="report-format"
              value={report.format}
              onChange={(e) => setReport({ ...report, format: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
            >
              <option value="PDF">PDF</option>
              <option value="EXCEL">Excel</option>
              <option value="CSV">CSV</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1B2340] mb-1.5">
            Date Range <span className="font-normal text-[#98A2B3]">(optional)</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="report-date-from" className="block text-xs text-[#667085] mb-1">From</label>
              <input
                id="report-date-from"
                type="date"
                value={report.filters?.dateFrom || ''}
                onChange={(e) =>
                  setReport({ ...report, filters: { ...report.filters, dateFrom: e.target.value } })
                }
                className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
            </div>
            <div>
              <label htmlFor="report-date-to" className="block text-xs text-[#667085] mb-1">To</label>
              <input
                id="report-date-to"
                type="date"
                value={report.filters?.dateTo || ''}
                onChange={(e) =>
                  setReport({ ...report, filters: { ...report.filters, dateTo: e.target.value } })
                }
                className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
            </div>
          </div>
          <p className="text-xs text-[#98A2B3] mt-1.5">Leave both empty to include all dates.</p>
        </div>
        {report.format === 'PDF' && (
          <div>
            <label className="block text-sm font-medium text-[#1B2340] mb-1.5">
              Page Orientation (PDF)
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm text-[#334155]">
                <input
                  type="radio"
                  checked={report.settings.pageOrientation === 'portrait'}
                  onChange={() =>
                    setReport({ ...report, settings: { ...report.settings, pageOrientation: 'portrait' } })
                  }
                />
                Portrait
              </label>
              <label className="flex items-center gap-1.5 text-sm text-[#334155]">
                <input
                  type="radio"
                  checked={report.settings.pageOrientation === 'landscape'}
                  onChange={() =>
                    setReport({ ...report, settings: { ...report.settings, pageOrientation: 'landscape' } })
                  }
                />
                Landscape
              </label>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#1B2340] mb-1.5">Include in Report</label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-1.5 text-sm text-[#334155]">
              <input
                type="checkbox"
                checked={report.settings.includeCharts}
                onChange={(e) =>
                  setReport({ ...report, settings: { ...report.settings, includeCharts: e.target.checked } })
                }
              />
              Charts & Visualizations
            </label>
            <label className="flex items-center gap-1.5 text-sm text-[#334155]">
              <input
                type="checkbox"
                checked={report.settings.includeSummary}
                onChange={(e) =>
                  setReport({ ...report, settings: { ...report.settings, includeSummary: e.target.checked } })
                }
              />
              Summary Section
            </label>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="px-5 py-2.5 rounded-md bg-[#1B2340] text-white text-sm font-medium hover:bg-[#242b52] hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none"
        >
          {loading ? 'Creating...' : 'Create Report'}
        </button>
      </div>

      {/* Live plain-language summary of what this report will actually generate */}
      <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 xl:sticky xl:top-4 space-y-5">
        <p className="text-[11px] uppercase tracking-[0.15em] text-[#667085] font-semibold">
          What this will generate
        </p>

        <div>
          <p className="text-sm font-semibold text-[#1B2340] mb-1">{selectedType?.label}</p>
          <p className="text-sm text-[#667085] leading-relaxed">{selectedType?.desc}</p>
          <p className="text-sm text-[#1B2340] mt-2">
            {report.filters?.dateFrom && report.filters?.dateTo
              ? `Covers ${formatPickedDate(report.filters.dateFrom)} to ${formatPickedDate(report.filters.dateTo)}.`
              : report.filters?.dateFrom
              ? `Covers everything from ${formatPickedDate(report.filters.dateFrom)} onwards.`
              : report.filters?.dateTo
              ? `Covers everything up to ${formatPickedDate(report.filters.dateTo)}.`
              : 'Covers all dates.'}
          </p>
        </div>

        <div className="pt-4 border-t border-[#E4E7EC]">
          <p className="text-sm font-semibold text-[#1B2340] mb-1">{report.format} file</p>
          <p className="text-sm text-[#667085] leading-relaxed">{FORMAT_DESCRIPTIONS[report.format]}</p>
        </div>

        {report.format === 'PDF' && (
          <div className="pt-4 border-t border-[#E4E7EC]">
            <p className="text-sm font-semibold text-[#1B2340] mb-1">
              {report.settings.pageOrientation === 'portrait' ? 'Portrait' : 'Landscape'} layout
            </p>
            <p className="text-sm text-[#667085] leading-relaxed">
              {report.settings.pageOrientation === 'portrait'
                ? 'Taller than it is wide — standard for text-heavy reports.'
                : 'Wider than it is tall — better when tables or charts need more horizontal room.'}
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-[#E4E7EC] space-y-2">
          <p className="text-sm font-semibold text-[#1B2340]">Sections included</p>
          <div className="flex items-center gap-2 text-sm text-[#667085]">
            <span className={`w-1.5 h-1.5 rounded-full ${report.settings.includeCharts ? 'bg-[#12B76A]' : 'bg-[#D0D5DD]'}`} />
            Charts & Visualizations {!report.settings.includeCharts && '(off)'}
          </div>
          <div className="flex items-center gap-2 text-sm text-[#667085]">
            <span className={`w-1.5 h-1.5 rounded-full ${report.settings.includeSummary ? 'bg-[#12B76A]' : 'bg-[#D0D5DD]'}`} />
            Summary Section {!report.settings.includeSummary && '(off)'}
          </div>
        </div>

        <div className="pt-4 border-t border-[#E4E7EC]">
          <p className="text-xs text-[#98A2B3] leading-relaxed">
            Clicking "Create Report" saves this configuration — it doesn't generate the file yet. Find it
            afterwards under the "My Reports" tab, where a "Generate Report" button builds the actual
            {report.format} file on demand and downloads it.
          </p>
        </div>
      </div>
    </div>
  )
}