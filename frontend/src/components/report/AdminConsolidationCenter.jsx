import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import newsletterService from '../../services/newsletterService'
import collegeLogo from '../../assets/college-logo.jpg'
import { DraftRestoredBanner } from '../../hooks/useFormDraft'

export default function AdminConsolidationCenter() {
  const navigate = useNavigate()
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
  const [creatingNewsletterFor, setCreatingNewsletterFor] = useState(null)

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
      setSelectedIds(pendingReports.map((r) => r._id))
    } else {
      setSelectedIds([])
    }
  }

  const openNewsletterDraft = async (report) => {
    const consolidatedReportId = report.consolidatedReportId?._id || report.consolidatedReportId
    if (!consolidatedReportId) {
      toast.error('The consolidated institutional report is unavailable.')
      return
    }

    setCreatingNewsletterFor(report._id)
    try {
      const response = await newsletterService.generateFromConsolidatedReport(consolidatedReportId)
      toast.success(response.message || 'Newsletter draft is ready for review.')
      navigate('/newsletters', { state: { newsletterId: response.data._id } })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create a newsletter draft.')
    } finally {
      setCreatingNewsletterFor(null)
    }
  }

  const handleConsolidate = async (e) => {
    e.preventDefault()
    const reportIds = selectedIds.filter((id) => pendingReports.some((report) => report._id === id))
    if (reportIds.length === 0) {
      toast.error('Please select at least one coordinator report to consolidate.')
      return
    }

    setConsolidating(true)
    try {
      const res = await reportService.consolidateReports({
        reportIds,
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
  const selectedPendingIds = selectedIds.filter((id) => pendingReports.some((report) => report._id === id))

  const totalItemsSelected = reports
    .filter((r) => selectedPendingIds.includes(r._id))
    .reduce((sum, r) => sum + (r.curatedItems?.length || 0), 0)

  return (
    <div className="space-y-6">
      {draftRestored && (
        <DraftRestoredBanner
          onClear={clearAdminDraft}
          message="Your selected coordinator reports and draft notes have been restored from your previous session."
        />
      )}
      <p className="text-sm text-[#667085] max-w-3xl">
          Collect cluster reports from all coordinators, review curated faculty activities, and merge
          them into the final institutional newsletter report.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E4E7EC] rounded-xl p-5 shadow-sm">
          <div className="text-2xl font-semibold text-[#1B2340]">{reports.length}</div>
          <div className="text-xs text-[#667085] mt-1">Total coordinator reports</div>
        </div>
        <div className="bg-[#FFFBF2] border border-[#F4DBA3] rounded-xl p-5 shadow-sm">
          <div className="text-2xl font-semibold text-[#92400E]">{pendingReports.length}</div>
          <div className="text-xs text-[#B54708] mt-1">Pending consolidation</div>
        </div>
        <div className="bg-[#F0F9F4] border border-[#B7E4CE] rounded-xl p-5 shadow-sm">
          <div className="text-2xl font-semibold text-[#067647]">{consolidatedReports.length}</div>
          <div className="text-xs text-[#2E7D5B] mt-1">Already consolidated</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-[#E4E7EC] rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-700">
            {selectedPendingIds.length} of {pendingReports.length} Reports Selected ({totalItemsSelected} Activities)
          </span>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            onClick={() => selectAll(true)}
            className="text-xs text-[#1B2340] hover:text-[#C9962C] hover:underline font-medium"
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
          disabled={selectedPendingIds.length === 0}
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-[#C9962C] to-[#E0B563] hover:brightness-105 disabled:opacity-50 text-[#1B2340] text-xs font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <Layers size={14} /> Consolidate into Master Report ({selectedPendingIds.length})
        </button>
      </div>

      {/* Coordinator Reports Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-[#F8F9FB] text-left text-[11px] uppercase tracking-wide text-[#667085]">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={pendingReports.length > 0 && pendingReports.every((report) => selectedPendingIds.includes(report._id))}
                  onChange={(e) => selectAll(e.target.checked)}
                  className="rounded border-gray-300 text-[#1B2340] focus:ring-[#C9962C] h-4 w-4 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3">Report & Cluster</th>
              <th className="px-4 py-3">Coordinator</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Curated Activities</th>
              <th className="px-4 py-3">Date Submitted</th>
              <th className="px-4 py-3">Status</th>
              <th className="sticky right-0 z-20 min-w-[210px] bg-[#F8F9FB] px-4 py-3 text-right shadow-[-4px_0_8px_-6px_rgba(16,24,40,0.25)]">Actions</th>
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
                const isSelected = selectedPendingIds.includes(report._id)
                return (
                  <tr
                    key={report._id}
                    className={`group border-t border-[#EAECF0] hover:bg-[#FAFBFC] transition-colors ${
                      isSelected ? 'bg-[#FBF3E7]/60' : ''
                    }`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(report._id)}
                        disabled={report.status !== 'SUBMITTED_TO_ADMIN'}
                        className="rounded border-gray-300 text-[#1B2340] focus:ring-[#C9962C] h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="font-semibold text-gray-900">{report.name}</div>
                      <div className="text-xs text-[#9A6B17] font-medium">
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
                            ? 'bg-[#ECFDF3] text-[#067647]'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {report.status === 'CONSOLIDATED' ? 'Consolidated' : 'Submitted'}
                      </span>
                    </td>
                    <td className="sticky right-0 z-10 min-w-[210px] bg-white px-4 py-3 align-middle text-right shadow-[-4px_0_8px_-6px_rgba(16,24,40,0.25)] group-hover:bg-[#FAFBFC]">
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewReport(report)}
                          className="text-xs font-semibold text-[#1B2340] hover:text-[#C9962C] hover:underline cursor-pointer"
                        >
                          Preview
                        </button>
                        {report.status === 'CONSOLIDATED' && report.consolidatedReportId && (
                          <button
                            type="button"
                            onClick={() => openNewsletterDraft(report)}
                            disabled={
                              creatingNewsletterFor === report._id ||
                              report.consolidatedReportId.summary?.totalItems === 0
                            }
                            title={
                              report.consolidatedReportId.summary?.totalItems === 0
                                ? 'This report has no curated activities'
                                : undefined
                            }
                            className="text-xs font-semibold text-[#9A6B17] hover:text-[#1B2340] hover:underline disabled:opacity-50"
                          >
                            {creatingNewsletterFor === report._id
                              ? 'Preparing draft…'
                              : report.consolidatedReportId.summary?.totalItems === 0
                              ? 'No curated content'
                              : 'Create / open newsletter draft'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>
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
              <div className="bg-[#FBF3E7]/60 border border-[#F4DBA3] rounded-lg p-3 text-xs text-gray-700">
                <strong>Coordinator Comments:</strong> {previewReport.coordinatorComments}
              </div>
            )}

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {(previewReport.curatedItems || []).map((it, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-[#1B2340] text-[10px] bg-[#F2F4F7] px-2 py-0.5 rounded">
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
                      className="text-[#1B2340] hover:text-[#C9962C] hover:underline inline-block mt-1 font-medium"
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
                <strong className="text-[#1B2340]">{totalItemsSelected} activities</strong> into the
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
                  className="w-full border border-[#D0D5DD] rounded-lg px-3 py-2.5 text-sm text-[#1B2340] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
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
                  className="w-full border border-[#D0D5DD] rounded-lg px-3 py-2.5 text-sm text-[#1B2340] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
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
                  className="px-5 py-2.5 text-sm font-semibold text-[#1B2340] bg-gradient-to-r from-[#C9962C] to-[#E0B563] hover:brightness-105 rounded-lg transition-all disabled:opacity-50"
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
