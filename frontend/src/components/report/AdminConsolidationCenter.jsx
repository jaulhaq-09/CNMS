import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  FileText,
  CheckCircle,
  Clock,
  Layers,
  Eye,
  CheckSquare,
  Square,
  Download,
  Printer,
  Calendar,
  User,
  Building,
  Award,
} from 'lucide-react'
import reportService from '../../services/reportService'
import collegeLogo from '../../assets/college-logo.jpg'
import { DraftRestoredBanner } from '../../hooks/useFormDraft'

export default function AdminConsolidationCenter() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [consolidating, setConsolidating] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [previewReport, setPreviewReport] = useState(null)
  const [masterName, setMasterName] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [lastMasterReport, setLastMasterReport] = useState(null)
  const [draftRestored, setDraftRestored] = useState(false)

  const draftKey = 'cnms_draft_admin_consolidation'

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    setLoading(true)
    try {
      const res = await reportService.getCoordinatorReports()
      const data = res.data || []
      setReports(data)

      // Restore Admin draft if available
      try {
        const raw = localStorage.getItem(draftKey)
        if (raw) {
          const draft = JSON.parse(raw)
          if (Array.isArray(draft.selectedIds) && draft.selectedIds.length > 0) {
            setSelectedIds(draft.selectedIds)
            setDraftRestored(true)
          }
          if (draft.masterName) setMasterName(draft.masterName)
          if (draft.adminNotes) setAdminNotes(draft.adminNotes)
        } else {
          const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          setMasterName(`Final Institutional Newsletter Report - ${currentMonth}`)
        }
      } catch (e) {
        // ignore
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load coordinator reports')
    } finally {
      setLoading(false)
    }
  }

  // Auto-save Admin selection
  useEffect(() => {
    if (selectedIds.length === 0 && !adminNotes) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ selectedIds, masterName, adminNotes }))
      } catch (err) {
        // ignore
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [selectedIds, masterName, adminNotes])

  const clearAdminDraft = () => {
    try {
      localStorage.removeItem(draftKey)
      setSelectedIds([])
      setAdminNotes('')
      setDraftRestored(false)
      toast.success('Consolidation selections reset.')
    } catch (e) {
      // ignore
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const selectAll = (select) => {
    if (select) {
      setSelectedIds(reports.map((r) => r._id))
    } else {
      setSelectedIds([])
    }
  }

  const handleConsolidate = async (e) => {
    e.preventDefault()
    if (selectedIds.length === 0) {
      toast.error('Please select at least one coordinator report to consolidate.')
      return
    }

    setConsolidating(true)
    try {
      const res = await reportService.consolidateReports({
        reportIds: selectedIds,
        name: masterName,
        adminNotes,
      })
      toast.success('Master Institutional Report created successfully!')
      setLastMasterReport(res.data)
      setShowModal(false)
      setSelectedIds([])
      try {
        localStorage.removeItem(draftKey)
        setDraftRestored(false)
      } catch (e) {
        // ignore
      }
      loadReports()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to consolidate reports')
    } finally {
      setConsolidating(false)
    }
  }

  const pendingReports = reports.filter((r) => r.status === 'SUBMITTED_TO_ADMIN')
  const consolidatedReports = reports.filter((r) => r.status === 'CONSOLIDATED')

  const totalItemsSelected = reports
    .filter((r) => selectedIds.includes(r._id))
    .reduce((sum, r) => sum + (r.curatedItems?.length || 0), 0)

  return (
    <div className="space-y-6">
      {draftRestored && (
        <DraftRestoredBanner
          onClear={clearAdminDraft}
          message="Your selected coordinator reports and draft notes have been restored from your previous session."
        />
      )}
      {/* Header and Summary Cards */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
          Admin Report Consolidation Center
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Collect cluster reports from all coordinators, review curated faculty activities, and merge
          them into the final institutional newsletter report.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{reports.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Coordinator Reports</div>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm bg-amber-50/30">
          <div className="text-2xl font-bold text-amber-700">{pendingReports.length}</div>
          <div className="text-xs text-amber-600 mt-1">Pending Consolidation</div>
        </div>
        <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-sm bg-purple-50/30">
          <div className="text-2xl font-bold text-purple-700">{consolidatedReports.length}</div>
          <div className="text-xs text-purple-600 mt-1">Already Consolidated</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-700">
            {selectedIds.length} of {reports.length} Reports Selected ({totalItemsSelected} Activities)
          </span>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            onClick={() => selectAll(true)}
            className="text-xs text-indigo-600 hover:underline font-medium"
          >
            Select All
          </button>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            onClick={() => selectAll(false)}
            className="text-xs text-gray-500 hover:underline font-medium"
          >
            Clear
          </button>
        </div>

        <button
          type="button"
          disabled={selectedIds.length === 0}
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#4338CA] hover:bg-[#3730A3] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <Layers size={14} /> Consolidate into Master Report ({selectedIds.length})
        </button>
      </div>

      {/* Coordinator Reports Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={reports.length > 0 && selectedIds.length === reports.length}
                  onChange={(e) => selectAll(e.target.checked)}
                  className="rounded border-gray-300 text-[#4338CA] focus:ring-[#4338CA] h-4 w-4 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3">Report & Cluster</th>
              <th className="px-4 py-3">Coordinator</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Curated Activities</th>
              <th className="px-4 py-3">Date Submitted</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  Loading coordinator submissions…
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No coordinator reports submitted yet. When coordinators curate and forward their
                  cluster activities, they will appear here.
                </td>
              </tr>
            ) : (
              reports.map((report) => {
                const isSelected = selectedIds.includes(report._id)
                return (
                  <tr
                    key={report._id}
                    className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(report._id)}
                        className="rounded border-gray-300 text-[#4338CA] focus:ring-[#4338CA] h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="font-semibold text-gray-900">{report.name}</div>
                      <div className="text-xs text-indigo-600 font-medium">
                        Cluster: {report.cluster || 'General'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-gray-700">
                      {report.forwardedBy
                        ? `${report.forwardedBy.firstName} ${report.forwardedBy.lastName}`
                        : 'Coordinator'}
                      <div className="text-[11px] text-gray-400">
                        {report.forwardedBy?.email || ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-gray-600">
                      {report.department?.name || 'Department'}
                    </td>
                    <td className="px-4 py-3 align-middle text-xs font-semibold text-gray-800">
                      {report.curatedItems?.length || 0} activities
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-gray-500">
                      {new Date(report.forwardedAt || report.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          report.status === 'CONSOLIDATED'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {report.status === 'CONSOLIDATED' ? 'Consolidated' : 'Submitted'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <button
                        type="button"
                        onClick={() => setPreviewReport(report)}
                        className="text-xs font-semibold text-[#4338CA] hover:underline cursor-pointer"
                      >
                        Preview
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Preview Modal for a Coordinator Report */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{previewReport.name}</h3>
                <p className="text-xs text-gray-500">
                  Cluster: {previewReport.cluster} · Coordinator:{' '}
                  {previewReport.forwardedBy
                    ? `${previewReport.forwardedBy.firstName} ${previewReport.forwardedBy.lastName}`
                    : 'Coordinator'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>

            {previewReport.coordinatorComments && (
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3 text-xs text-gray-700">
                <strong>Coordinator Comments:</strong> {previewReport.coordinatorComments}
              </div>
            )}

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {(previewReport.curatedItems || []).map((it, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-[#4338CA] text-[10px] bg-indigo-50 px-2 py-0.5 rounded">
                      {it.type}
                    </span>
                    <span className="text-gray-400">{new Date(it.date).toLocaleDateString()}</span>
                  </div>
                  <div className="font-semibold text-gray-900">{it.title}</div>
                  <div className="text-gray-600">
                    Faculty: {it.facultyName} ({it.facultyEmail})
                  </div>
                  {it.description && <div className="text-gray-500">{it.description}</div>}
                  {it.coordinatorRemarks && (
                    <div className="text-amber-800 font-medium">
                      Note: {it.coordinatorRemarks}
                    </div>
                  )}
                  {it.certificateUrl && (
                    <a
                      href={it.certificateUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline inline-block mt-1 font-medium"
                    >
                      View Certificate / Paper
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Consolidation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Consolidate into Final Institutional Report
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                You are consolidating <strong className="text-gray-900">{selectedIds.length} coordinator reports</strong> containing{' '}
                <strong className="text-[#4338CA]">{totalItemsSelected} activities</strong> into the
                single master institutional newsletter report.
              </p>
            </div>

            <form onSubmit={handleConsolidate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Final Institutional Report Title
                </label>
                <input
                  type="text"
                  required
                  value={masterName}
                  onChange={(e) => setMasterName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338CA]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Admin Editorial Notes & Remarks
                </label>
                <textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="e.g. Master compilation approved for Institute Newsletter Volume X, Issue Y."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#4338CA]/30"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={consolidating}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#4338CA] hover:bg-[#3730A3] rounded-md transition-colors disabled:opacity-50"
                >
                  {consolidating ? 'Consolidating…' : 'Generate Master Institutional Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Banner if Master Report was just generated */}
      {lastMasterReport && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-600" size={24} />
              <div>
                <h3 className="text-sm font-bold text-green-900">
                  {lastMasterReport.name} Generated!
                </h3>
                <p className="text-xs text-green-700">
                  Consolidated from {lastMasterReport.summary?.totalCoordinators || selectedIds.length} coordinator reports with{' '}
                  {lastMasterReport.curatedItems?.length} activities.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-md text-xs font-semibold flex items-center gap-1.5"
            >
              <Printer size={14} /> Print / Save as PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

