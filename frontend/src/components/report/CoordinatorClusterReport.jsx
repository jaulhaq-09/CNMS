import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import {
  FileText,
  CheckCircle,
  Clock,
  Send,
  Eye,
  Calendar,
  User,
  Building,
  CheckSquare,
  Square,
  AlertCircle,
  Printer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import reportService from '../../services/reportService'
import collegeLogo from '../../assets/college-logo.jpg'
import { DraftRestoredBanner } from '../../hooks/useFormDraft'

export default function CoordinatorClusterReport() {
  const currentUser = useSelector((state) => state.auth?.user)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(false)
  const [forwarding, setForwarding] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [coordinatorComments, setCoordinatorComments] = useState('')
  const [reportName, setReportName] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [expandedItem, setExpandedItem] = useState(null)
  const [previousReports, setPreviousReports] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)

  const userClusters = currentUser?.clusters || []
  const [selectedCluster, setSelectedCluster] = useState(userClusters[0] || '')

  const draftKey = `cnms_draft_coord_report_${currentUser?._id || 'anon'}_${selectedCluster || 'default'}`

  useEffect(() => {
    loadApprovedActivities()
    loadReportsHistory()
  }, [selectedCluster])

  const loadApprovedActivities = async () => {
    setLoading(true)
    try {
      const res = await reportService.getApprovedActivities({
        cluster: selectedCluster || undefined,
      })

      // Check if user had an in-progress curation draft saved
      let savedDraft = null
      try {
        const raw = localStorage.getItem(draftKey)
        if (raw) savedDraft = JSON.parse(raw)
      } catch (e) {
        // ignore
      }

      const items = (res.data || []).map((it) => {
        const wasSaved = savedDraft?.items?.[it.id]
        return {
          ...it,
          included: wasSaved !== undefined ? wasSaved.included : true,
          coordinatorRemarks: wasSaved?.coordinatorRemarks || '',
        }
      })

      setActivities(items)
      const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      setReportName(
        savedDraft?.reportName || `Cluster Report - ${selectedCluster || 'Default'} (${currentMonth})`
      )
      if (savedDraft?.coordinatorComments) {
        setCoordinatorComments(savedDraft.coordinatorComments)
      }

      if (savedDraft && Object.keys(savedDraft.items || {}).length > 0) {
        setDraftRestored(true)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load approved activities')
    } finally {
      setLoading(false)
    }
  }

  // Auto-save coordinator in-progress curation state
  useEffect(() => {
    if (activities.length === 0) return
    const timer = setTimeout(() => {
      try {
        const draftObj = {
          reportName,
          coordinatorComments,
          items: activities.reduce((acc, it) => {
            acc[it.id] = { included: it.included, coordinatorRemarks: it.coordinatorRemarks }
            return acc
          }, {}),
        }
        localStorage.setItem(draftKey, JSON.stringify(draftObj))
      } catch (err) {
        console.warn('Failed to save coordinator report draft:', err)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [activities, coordinatorComments, reportName, draftKey])

  const clearCoordDraft = () => {
    try {
      localStorage.removeItem(draftKey)
      setDraftRestored(false)
      loadApprovedActivities()
      toast.success('Draft cleared. Form reset to fresh approved activities.')
    } catch (e) {
      // ignore
    }
  }

  const loadReportsHistory = async () => {
    try {
      const res = await reportService.getAll(1, 20)
      const clusterReports = (res.data || []).filter(
        (r) => r.type === 'CLUSTER_REPORT' || r.status === 'SUBMITTED_TO_ADMIN' || r.status === 'CONSOLIDATED'
      )
      setPreviousReports(clusterReports)
    } catch (err) {
      // non-fatal
    }
  }

  const toggleInclude = (id) => {
    setActivities((prev) =>
      prev.map((it) => (it.id === id ? { ...it, included: !it.included } : it))
    )
  }

  const updateRemarks = (id, remarks) => {
    setActivities((prev) =>
      prev.map((it) => (it.id === id ? { ...it, coordinatorRemarks: remarks } : it))
    )
  }

  const toggleAll = (select) => {
    setActivities((prev) => prev.map((it) => ({ ...it, included: select })))
  }

  const includedCount = activities.filter((it) => it.included).length

  const handleForwardReport = async (e) => {
    e.preventDefault()
    if (includedCount === 0) {
      toast.error('Please select at least one activity to include in the report.')
      return
    }

    setForwarding(true)
    try {
      await reportService.forwardClusterReport({
        name: reportName,
        cluster: selectedCluster || currentUser?.clusters?.[0] || 'Cluster',
        department: currentUser?.department?._id || currentUser?.department,
        curatedItems: activities.filter((it) => it.included),
        coordinatorComments,
      })
      toast.success('Cluster report forwarded to Admin successfully!')
      setShowConfirmModal(false)
      setCoordinatorComments('')
      try {
        localStorage.removeItem(draftKey)
        setDraftRestored(false)
      } catch (e) {
        // ignore
      }
      loadReportsHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to forward report to Admin')
    } finally {
      setForwarding(false)
    }
  }

  const filteredActivities = activities.filter((it) => {
    if (categoryFilter === 'ALL') return true
    return it.type === categoryFilter || it.category === categoryFilter
  })

  return (
    <div className="space-y-6">
      {draftRestored && (
        <DraftRestoredBanner
          onClear={clearCoordDraft}
          message="Your in-progress activity selections and coordinator notes were automatically restored from your previous session."
        />
      )}
      {/* Cluster report header and controls */}
      <div className="bg-white border border-[#E4E7EC] rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#EAECF0] pb-5">
          <div className="flex items-center gap-4">
            <img
              src={collegeLogo}
              alt="BMSIT Logo"
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border border-[#C9962C]/30"
            />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8F6317]">
                Coordinator workspace
              </div>
              <h2 className="text-xl font-semibold text-[#1B2340] mt-0.5">
                Cluster Faculty Activity Report
              </h2>
              <p className="text-sm text-[#667085] mt-1">
                Department: {currentUser?.department?.name || 'Department'} · Coordinator:{' '}
                {currentUser?.firstName} {currentUser?.lastName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {userClusters.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-[#667085] font-medium">
                <span>Cluster</span>
                <select
                  value={selectedCluster}
                  onChange={(e) => setSelectedCluster(e.target.value)}
                  className="border border-[#D0D5DD] rounded-lg px-3 py-2 text-sm bg-white font-medium text-[#1B2340] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/40"
                >
                  {userClusters.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {userClusters.length === 1 && (
              <span className="rounded-lg bg-[#FBF3E7] px-3 py-2 text-sm font-semibold text-[#8F6317]">
                {userClusters[0]}
              </span>
            )}
            {userClusters.length === 0 && (
              <span className="rounded-lg bg-[#F2F4F7] px-3 py-2 text-sm text-[#667085]">
                No cluster assigned
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-[#D0D5DD] text-[#344054] hover:bg-[#F9FAFB] transition-colors"
            >
              {showHistory ? 'Hide Submissions' : `Forwarded Submissions (${previousReports.length})`}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-[#D0D5DD] text-[#344054] hover:bg-[#F9FAFB] transition-colors flex items-center gap-1.5"
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        {/* Curation and Forward Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-sm text-[#667085]">
              Approved activities <strong className="text-[#1B2340]">{activities.length}</strong>
            </span>
            <span className="text-sm text-[#667085]">
              Selected for report <strong className="text-[#8F6317]">{includedCount}</strong>
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleAll(true)}
                className="text-xs text-[#8F6317] hover:underline font-semibold"
              >
                Select All
              </button>
              <span className="text-gray-300">·</span>
              <button
                type="button"
                onClick={() => toggleAll(false)}
                className="text-xs text-[#667085] hover:underline font-semibold"
              >
                Deselect All
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={includedCount === 0}
            onClick={() => setShowConfirmModal(true)}
            className="flex items-center justify-center gap-2 bg-[#1B2340] hover:bg-[#29345A] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C9962C] focus:ring-offset-2"
          >
            <Send size={14} /> Forward Report to Admin ({includedCount})
          </button>
        </div>
      </div>

      {/* Previously Forwarded Reports History Card */}
      {showHistory && (
        <div className="bg-[#FFFBF2] border border-[#F4DBA3] rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#1B2340]">Your forwarded cluster reports</h2>
          {previousReports.length === 0 ? (
            <p className="text-xs text-gray-500">No reports have been forwarded yet.</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {previousReports.map((r) => (
                <div key={r._id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-[#1B2340]">{r.name}</div>
                    <div className="text-xs text-[#667085]">
                      Cluster: {r.cluster || 'General'} · Forwarded:{' '}
                      {new Date(r.forwardedAt || r.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                        r.status === 'CONSOLIDATED'
                          ? 'bg-[#ECFDF3] text-[#067647]'
                          : 'bg-[#FBF3E7] text-[#8F6317]'
                      }`}
                    >
                      {r.status === 'CONSOLIDATED' ? 'Consolidated by Admin' : 'Submitted to Admin'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-[#E4E7EC] pb-1" role="group" aria-label="Filter activities by category">
        {['ALL', 'EVENT', 'PUBLICATION', 'PATENT', 'ACHIEVEMENT', 'NPTEL'].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            aria-pressed={categoryFilter === cat}
            className={`px-3 py-1.5 rounded-t-md text-xs font-semibold transition-colors ${
              categoryFilter === cat
                ? 'border-b-2 border-[#C9962C] text-[#1B2340]'
                : 'text-[#667085] hover:text-[#1B2340]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Curated Activity List */}
      {loading ? (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-8 text-center text-sm text-[#667085]" role="status">Loading approved activities…</div>
      ) : filteredActivities.length === 0 ? (
        <div className="bg-white border border-dashed border-[#D0D5DD] rounded-xl p-8 sm:p-10 text-center text-[#667085]">
          No approved activities found for this cluster. When faculty posts are accepted, they appear
          here for you to review and compile into the report.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((item) => (
            <div
              key={item.id}
              className={`bg-white border rounded-xl p-4 transition-all ${
                item.included
                  ? 'border-[#E4E7EC] shadow-sm hover:border-[#C9962C]/60'
                  : 'border-[#E4E7EC] opacity-60 bg-[#F9FAFB]'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleInclude(item.id)}
                    className="mt-1 text-[#98A2B3] hover:text-[#8F6317] transition-colors cursor-pointer"
                    title={item.included ? 'Click to exclude' : 'Click to include'}
                    aria-label={`${item.included ? 'Exclude' : 'Include'} ${item.title} in report`}
                  >
                    {item.included ? (
                      <CheckSquare size={20} className="text-[#8F6317]" />
                    ) : (
                      <Square size={20} />
                    )}
                  </button>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#FBF3E7] text-[#8F6317]">
                        {item.type}
                      </span>
                      <span className="text-xs text-[#667085]">
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-[#1B2340] mt-1">{item.title}</h3>

                    <div className="text-xs text-[#667085] mt-1 flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1">
                        <User size={12} className="text-[#98A2B3]" />
                        {item.facultyName} ({item.facultyEmail})
                      </span>
                      {item.cluster && (
                        <span className="flex items-center gap-1 text-[#667085]">
                          Cluster: {item.cluster}
                        </span>
                      )}
                    </div>

                    {item.description && (
                      <p className="text-xs text-[#667085] mt-2 line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    {item.certificateUrl && (
                      <div className="mt-2">
                        <a
                          href={item.certificateUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[#8F6317] hover:underline font-semibold inline-flex items-center gap-1"
                        >
                          <Eye size={12} /> View Certificate
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 w-full shrink-0 md:mt-0 md:w-64">
                  <label htmlFor={`coordinator-remarks-${item.id}`} className="block text-[11px] font-medium text-[#475467] mb-1">
                    Coordinator Notes / Edits:
                  </label>
                  <input
                    id={`coordinator-remarks-${item.id}`}
                    type="text"
                    value={item.coordinatorRemarks || ''}
                    onChange={(e) => updateRemarks(item.id, e.target.value)}
                    placeholder="e.g. Highlight in cluster spotlight..."
                    className="w-full border border-[#D0D5DD] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9962C]/40"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal to Forward to Admin */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="forward-cluster-report-title"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 sm:p-6 space-y-4"
          >
            <div>
              <h2 id="forward-cluster-report-title" className="text-lg font-semibold text-[#1B2340]">
                Forward cluster report to Admin
              </h2>
              <p className="text-sm text-[#667085] mt-1">
                You are about to submit your cluster report with{' '}
                <strong className="text-[#1B2340]">{includedCount} curated activities</strong> to the
                central Admin for final institutional consolidation.
              </p>
            </div>

            <form onSubmit={handleForwardReport} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#344054] mb-1.5">
                  Report Title
                </label>
                <input
                  type="text"
                  required
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="w-full border border-[#D0D5DD] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9962C]/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#344054] mb-1.5">
                  Coordinator Remarks / Summary for Admin
                </label>
                <textarea
                  rows={3}
                  value={coordinatorComments}
                  onChange={(e) => setCoordinatorComments(e.target.value)}
                  placeholder="e.g. All cluster faculty submissions have been verified and approved. Ready for monthly newsletter."
                  className="w-full border border-[#D0D5DD] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9962C]/40"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-[#475467] hover:bg-[#F2F4F7] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forwarding}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1B2340] hover:bg-[#29345A] rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#C9962C] focus:ring-offset-2"
                >
                  {forwarding ? 'Submitting…' : 'Confirm & Forward to Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
