import React, { useState } from 'react'
import toast from 'react-hot-toast'
import reportService from '../services/reportService'
import { formatDateLong } from '../utils/date'

const FORMAT_META = {
  PDF: { ext: 'pdf', mime: 'application/pdf', viewable: true },
  EXCEL: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', viewable: false },
  CSV: { ext: 'csv', mime: 'text/csv', viewable: false },
}

const TYPE_LABELS = {
  EVENTS: 'Events Report',
  NEWSLETTERS: 'Newsletters Report',
  PUBLICATIONS: 'Publications Report',
  PATENTS: 'Patents Report',
  ACHIEVEMENTS: 'Faculty Achievements Report',
  NPTEL: 'NPTEL Courses Report',
  TEMPLATES: 'Templates Report',
  ACTIVITY: 'Activity Report',
}

// When a request is made with responseType: 'blob', a failed request's
// error body is ALSO a Blob (even for JSON error responses) — so
// err.response.data.message is always undefined and every failure looks
// like a generic, unhelpful error. This reads the blob as text and tries
// to parse the real backend message out of it.
async function extractErrorMessage(err) {
  const data = err?.response?.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const parsed = JSON.parse(text)
      return parsed?.message || text || 'Failed to generate report'
    } catch {
      return 'Failed to generate report'
    }
  }
  return err?.response?.data?.message || err?.message || 'Failed to generate report'
}

export default function ReportsList({ reports, loading, onChanged }) {
  const [generatingId, setGeneratingId] = useState(null)
  const [generated, setGenerated] = useState({}) // { [reportId]: { url, meta } }
  const [confirmTarget, setConfirmTarget] = useState(null) // report pending delete confirmation
  const [deletingId, setDeletingId] = useState(null)

  const handleGenerate = async (report) => {
    const meta = FORMAT_META[report.format] || FORMAT_META.PDF
    try {
      setGeneratingId(report._id)
      const response = await reportService.generate(report._id)
      const blob = new Blob([response.data], { type: meta.mime })
      const url = window.URL.createObjectURL(blob)

      setGenerated((prev) => {
        if (prev[report._id]?.url) window.URL.revokeObjectURL(prev[report._id].url)
        return { ...prev, [report._id]: { url, meta } }
      })
      toast.success('Report generated')
    } catch (err) {
      const message = await extractErrorMessage(err)
      toast.error(message)
    } finally {
      setGeneratingId(null)
    }
  }

  const handleView = (report) => {
    const entry = generated[report._id]
    if (entry) window.open(entry.url, '_blank', 'noopener,noreferrer')
  }

  const handleDownload = (report) => {
    const entry = generated[report._id]
    if (!entry) return
    const link = document.createElement('a')
    link.href = entry.url
    link.download = `${(report.name || 'report').replace(/\s+/g, '-')}.${entry.meta.ext}`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const confirmDelete = async () => {
    const report = confirmTarget
    if (!report) return
    try {
      setDeletingId(report._id)
      await reportService.delete(report._id)
      toast.success('Report deleted')
      setConfirmTarget(null)
      if (onChanged) onChanged()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete report')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-[#E4E7EC] rounded-xl divide-y divide-[#E4E7EC] overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 space-y-2">
            <div className="h-4 w-1/3 bg-[#F2F4F7] rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-[#F2F4F7] rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="bg-white border border-dashed border-[#E4E7EC] rounded-xl py-16 px-6 text-center">
        <p className="font-serif font-semibold text-lg text-[#1B2340] mb-1">No reports yet</p>
        <p className="text-sm text-[#667085]">
          Reports you build in the "Build Report" tab will show up here, ready to generate and download.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white border border-[#E4E7EC] rounded-xl divide-y divide-[#E4E7EC] overflow-hidden">
        {reports.map((report) => {
          const isGenerating = generatingId === report._id
          const entry = generated[report._id]
          const meta = FORMAT_META[report.format] || FORMAT_META.PDF

          return (
            <div
              key={report._id}
              className="p-5 flex items-center justify-between gap-4 flex-wrap hover:bg-[#F5F6F8] transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-[#1B2340] truncate">{report.name}</p>
                <p className="text-sm text-[#667085] mt-0.5">
                  {TYPE_LABELS[report.type] || report.type} &middot; {report.format}
                  {report.createdAt && <> &middot; {formatDateLong(report.createdAt)}</>}
                </p>
                {report.description && (
                  <p className="text-xs text-[#98A2B3] mt-1 truncate">{report.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!entry ? (
                  <button
                    onClick={() => handleGenerate(report)}
                    disabled={isGenerating}
                    className="px-3.5 py-2 rounded-md bg-[#1B2340] text-white text-sm font-medium hover:bg-[#242b52] transition-colors disabled:opacity-60"
                  >
                    {isGenerating ? 'Generating…' : 'Generate Report'}
                  </button>
                ) : (
                  <>
                    {meta.viewable && (
                      <button
                        onClick={() => handleView(report)}
                        className="px-3.5 py-2 rounded-md border border-[#E4E7EC] text-[#1B2340] text-sm font-medium hover:border-[#C9962C] hover:text-[#C9962C] transition-colors"
                      >
                        View
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(report)}
                      className="px-3.5 py-2 rounded-md bg-[#1B2340] text-white text-sm font-medium hover:bg-[#242b52] transition-colors"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleGenerate(report)}
                      disabled={isGenerating}
                      className="text-xs text-[#98A2B3] hover:text-[#C9962C] transition-colors underline-offset-2 hover:underline disabled:opacity-60"
                    >
                      {isGenerating ? '…' : 'Regenerate'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setConfirmTarget(report)}
                  className="px-3 py-2 rounded-md border border-[#E4E7EC] text-[#667085] text-sm hover:border-red-300 hover:text-red-600 transition-colors"
                  title="Delete report"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <p className="font-serif font-semibold text-lg text-[#1B2340] mb-2">Delete report?</p>
            <p className="text-sm text-[#667085] mb-6">
              "{confirmTarget.name}" will be permanently deleted. This can't be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId === confirmTarget._id}
                className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deletingId === confirmTarget._id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}