import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import newsletterService from '../services/newsletterService'
import templateService from '../services/templateService'
import exportService from '../services/exportService'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS } from '../config/permissions'
import Pagination from '../components/common/Pagination'
import { formatDate, formatDateTime, formatDateRange } from '../utils/date'

const TABS = [
  { key: '', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'PUBLISHED', label: 'Published' },
]

const STATUS_STYLES = {
  DRAFT: 'bg-[#F2F4F7] text-[#667085]',
  SCHEDULED: 'bg-[#FBF3E7] text-[#B07C1F]',
  PUBLISHED: 'bg-[#ECFDF3] text-[#067647]',
  ARCHIVED: 'bg-[#F2F4F7] text-[#667085]',
}

const INPUT_CLASS =
  'w-full px-2.5 py-1.5 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]'
const LABEL_CLASS = 'block text-[11px] uppercase tracking-wide text-[#98A2B3] font-semibold mb-1'

// "YYYY-MM-DDTHH:mm" in local time, used as the minimum for the schedule picker.
const nowForInput = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function NewslettersPage() {
  const { can } = usePermissions()
  const canGenerate = can(PERMISSIONS.NEWSLETTER_GENERATE)
  const canManage = can(PERMISSIONS.NEWSLETTER_PUBLISH)
  const canExport = can(PERMISSIONS.EXPORT_VIEW)
  // Only the Admin sees drafts and scheduled issues.
  const visibleTabs = canManage ? TABS : TABS.filter((t) => t.key === 'PUBLISHED')

  // List
  const [newsletters, setNewsletters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(canManage ? '' : 'PUBLISHED')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ totalPages: 1 })

  // Card actions
  const [expandedId, setExpandedId] = useState(null)
  const [schedulingId, setSchedulingId] = useState(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [publishConfirmId, setPublishConfirmId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [exporting, setExporting] = useState(false)

  // Generate panel
  const [panelOpen, setPanelOpen] = useState(false)
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(
    async (pageNum = 1, status = tab) => {
      try {
        setLoading(true)
        setError('')
        const filters = status ? { status } : {}
        const response = await newsletterService.getAll(filters, pageNum, 10)
        setNewsletters(response.data || [])
        setPagination({ totalPages: response.pagination?.totalPages || 1 })
        setPage(pageNum)
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load newsletters.')
      } finally {
        setLoading(false)
      }
    },
    [tab]
  )

  useEffect(() => {
    load(1, tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const openPanel = async () => {
    setPanelOpen(true)
    if (templates.length > 0 || templatesLoading) return
    setTemplatesLoading(true)
    try {
      const response = await templateService.getAll({}, 1, 100)
      setTemplates(Array.isArray(response?.data) ? response.data : [])
    } catch (err) {
      // Not fatal: the backend falls back to the default template.
      setTemplates([])
    } finally {
      setTemplatesLoading(false)
    }
  }

  const closePanel = () => {
    setPanelOpen(false)
    setConfirming(false)
    setFormError('')
  }

  const handleReview = (e) => {
    e.preventDefault()
    setFormError('')
    if (!startDate || !endDate) {
      setFormError('Choose a start and end date for the reporting period.')
      return
    }
    if (new Date(startDate) > new Date(endDate)) {
      setFormError('The start date must be before the end date.')
      return
    }
    setConfirming(true)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setFormError('')
    try {
      const response = await newsletterService.generate(startDate, endDate, templateId || undefined)
      const created = response.data
      toast.success('Newsletter generated and saved as a draft')
      closePanel()
      setStartDate('')
      setEndDate('')
      setTemplateId('')
      // Show the new draft at the top of the Drafts tab, preview open.
      setTab('DRAFT')
      await load(1, 'DRAFT')
      setExpandedId(created?._id || null)
    } catch (err) {
      const message = err.response?.data?.message || 'Could not generate a newsletter for this period.'
      setFormError(message)
      setConfirming(false)
      toast.error(message)
    } finally {
      setGenerating(false)
    }
  }

  const handlePublish = async (id) => {
    setActioningId(id)
    try {
      await newsletterService.publish(id)
      toast.success('Newsletter published and emailed')
      setPublishConfirmId(null)
      await load(page)
    } catch (err) {
      const message = err.response?.data?.message || 'Could not publish this newsletter.'
      setError(message)
      toast.error(message)
      setPublishConfirmId(null)
    } finally {
      setActioningId(null)
    }
  }

  const handleSchedule = async (id) => {
    if (!scheduleDate) {
      toast.error('Choose a date and time to schedule.')
      return
    }
    if (new Date(scheduleDate).getTime() <= Date.now()) {
      toast.error('Choose a date and time in the future.')
      return
    }
    setActioningId(id)
    try {
      await newsletterService.schedule(id, new Date(scheduleDate).toISOString())
      toast.success('Newsletter scheduled')
      setSchedulingId(null)
      setScheduleDate('')
      await load(page)
    } catch (err) {
      const message = err.response?.data?.message || 'Could not schedule this newsletter.'
      setError(message)
      toast.error(message)
    } finally {
      setActioningId(null)
    }
  }

  const handleDelete = async (id) => {
    try {
      await newsletterService.delete(id)
      toast.success('Newsletter deleted')
      setDeleteConfirmId(null)
      await load(page)
    } catch (err) {
      const message = err.response?.data?.message || 'Could not delete this newsletter.'
      setError(message)
      toast.error(message)
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const response = await exportService.exportNewsletters({}, 'EXCEL')
      exportService.downloadFile(response.data, `newsletters_${Date.now()}.xlsx`)
      toast.success('Newsletters exported')
    } catch (err) {
      toast.error('Could not export newsletters.')
    } finally {
      setExporting(false)
    }
  }

  const selectedTemplateLabel = (() => {
    if (!templateId) return 'Default / MPR template'
    const t = templates.find((tpl) => tpl._id === templateId)
    return t ? `${t.name}${t.isMprTemplate ? ' (MPR)' : ''}` : 'Selected template'
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif font-semibold text-2xl text-[#1B2340]">Newsletters</h2>
          <p className="text-sm text-[#667085] mt-1">
            {canManage
              ? 'The monthly college newsletter is drafted for you on the last day of each month. Review it, then publish or schedule it.'
              : 'Published college newsletters.'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canExport && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              title="Download all newsletters as an Excel file"
              className="text-sm font-medium px-4 py-2 rounded-md border border-[#C9962C] text-[#1B2340] hover:bg-[#C9962C]/10 disabled:opacity-60"
            >
              {exporting ? 'Exporting…' : 'Export Excel'}
            </button>
          )}
          {canGenerate && !panelOpen && (
            <button
              type="button"
              onClick={openPanel}
              className="text-sm font-semibold px-4 py-2 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              + New newsletter
            </button>
          )}
        </div>
      </div>

      {panelOpen && canGenerate && (
        <form
          onSubmit={handleReview}
          className="bg-white border border-[#E4E7EC] rounded-lg p-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-[#1B2340]">New newsletter</h3>
              <p className="text-xs text-[#667085] mt-1">
                Every approved event, publication, patent, achievement and NPTEL course in this period
                is compiled into a draft.
              </p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              disabled={generating}
              className="text-xs text-[#667085] hover:underline disabled:opacity-50"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="nl-start" className={LABEL_CLASS}>Period start</label>
              <input
                id="nl-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setConfirming(false)
                }}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="nl-end" className={LABEL_CLASS}>Period end</label>
              <input
                id="nl-end"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setConfirming(false)
                }}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="nl-template" className={LABEL_CLASS}>Template</label>
              <select
                id="nl-template"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value)
                  setConfirming(false)
                }}
                disabled={templatesLoading}
                className={`${INPUT_CLASS} disabled:opacity-60`}
              >
                <option value="">
                  {templatesLoading ? 'Loading templates...' : 'Default / MPR template'}
                </option>
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                    {t.isMprTemplate ? ' (MPR)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formError && (
            <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
              {formError}
            </div>
          )}

          {!confirming ? (
            <button
              type="submit"
              className="px-5 py-2.5 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              Generate newsletter
            </button>
          ) : (
            <div className="bg-[#F5F6F8] border border-[#E4E7EC] rounded-md p-4 space-y-3">
              <p className="text-sm text-[#1B2340]">
                This will compile a draft for <strong>{formatDateRange(startDate, endDate)}</strong> using{' '}
                <strong>{selectedTemplateLabel}</strong> and advance the newsletter issue number. If you
                delete the draft afterward, fix the issue number in Settings.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={generating}
                  onClick={handleGenerate}
                  className="px-4 py-2 rounded-md bg-[#1B2340] text-white text-sm font-medium hover:bg-[#242b52] disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Confirm & generate'}
                </button>
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => setConfirming(false)}
                  className="px-4 py-2 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-white disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
          <button
            key={t.key || 'all'}
            type="button"
            onClick={() => {
              setTab(t.key)
              setExpandedId(null)
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              tab === t.key
                ? 'bg-[#1B2340] text-white border-[#1B2340]'
                : 'bg-white text-[#667085] border-[#E4E7EC] hover:bg-[#F5F6F8]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-[#B42318]">{error}</p>}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-[#E4E7EC] rounded-lg p-5 space-y-2">
              <div className="h-4 w-1/3 bg-[#F2F4F7] rounded animate-pulse" />
              <div className="h-3 w-1/4 bg-[#F2F4F7] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : newsletters.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E4E7EC] rounded-lg p-10 text-center">
          <p className="text-sm text-[#667085]">
            {canManage
              ? tab ? 'No newsletters in this tab.' : 'No newsletters yet.'
              : 'No newsletters have been published yet.'}
            {canGenerate && !tab && ' Use "New newsletter" to create the first one.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {newsletters.map((newsletter) => {
            const id = newsletter._id
            const isExpanded = expandedId === id
            const isScheduling = schedulingId === id
            const isActioning = actioningId === id
            const isDraftOrScheduled = newsletter.status === 'DRAFT' || newsletter.status === 'SCHEDULED'

            return (
              <div
                key={id}
                className="bg-white border border-[#E4E7EC] rounded-lg p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-[#1B2340]">{newsletter.name}</h3>
                    <p className="text-xs text-[#667085] mt-1">
                      {newsletter.periodStartDate && formatDate(newsletter.periodStartDate)}
                      {newsletter.periodEndDate && ` – ${formatDate(newsletter.periodEndDate)}`}
                      {' · '}
                      {newsletter.department?.name || 'College-wide'}
                      {newsletter.recipients?.totalCount != null &&
                        ` · ${newsletter.recipients.totalCount} items`}
                    </p>
                    {newsletter.status === 'PUBLISHED' && (
                      <p className="text-xs text-[#667085] mt-1">
                        Sent to {newsletter.deliveryStats?.totalSent ?? 0} recipients
                        {newsletter.deliveryStats?.delivered != null &&
                          ` · ${newsletter.deliveryStats.delivered} delivered`}
                      </p>
                    )}
                    {newsletter.status === 'SCHEDULED' && newsletter.scheduledFor && (
                      <p className="text-xs text-[#667085] mt-1">
                        Scheduled for {formatDateTime(newsletter.scheduledFor)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
                      STATUS_STYLES[newsletter.status] || 'bg-[#F2F4F7] text-[#667085]'
                    }`}
                  >
                    {newsletter.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : id)}
                    className="px-3 py-1.5 rounded-md border border-[#E4E7EC] text-xs text-[#667085] hover:bg-[#F5F6F8]"
                  >
                    {isExpanded ? 'Hide preview' : 'Preview'}
                  </button>

                  {canManage && newsletter.status === 'DRAFT' &&
                    (publishConfirmId === id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#667085]">
                          Email it to {newsletter.department?.name ? 'the department' : 'the whole college'} now?
                        </span>
                        <button
                          type="button"
                          disabled={isActioning}
                          onClick={() => handlePublish(id)}
                          className="text-xs font-semibold text-[#1B2340] hover:underline disabled:opacity-50"
                        >
                          {isActioning ? 'Publishing...' : 'Yes, publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPublishConfirmId(null)}
                          className="text-xs text-[#667085] hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPublishConfirmId(id)}
                        className="px-3 py-1.5 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-xs font-semibold hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all"
                      >
                        Publish now
                      </button>
                    ))}

                  {canManage && isDraftOrScheduled && (
                    <button
                      type="button"
                      onClick={() => {
                        setSchedulingId(isScheduling ? null : id)
                        setScheduleDate('')
                      }}
                      className="px-3 py-1.5 rounded-md border border-[#E4E7EC] text-xs text-[#667085] hover:bg-[#F5F6F8]"
                    >
                      {isScheduling ? 'Cancel' : newsletter.status === 'SCHEDULED' ? 'Reschedule' : 'Schedule'}
                    </button>
                  )}

                  {canManage && newsletter.status !== 'PUBLISHED' &&
                    (deleteConfirmId === id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Delete?</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(id)}
                          className="text-red-600 font-semibold text-xs hover:underline"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-gray-500 text-xs hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(id)}
                        className="px-3 py-1.5 rounded-md border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    ))}
                </div>

                {isScheduling && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="datetime-local"
                      min={nowForInput()}
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="border border-[#E4E7EC] rounded-md px-3 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={isActioning}
                      onClick={() => handleSchedule(id)}
                      className="px-3 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-medium hover:bg-[#242b52] disabled:opacity-50"
                    >
                      {isActioning ? 'Saving...' : 'Confirm'}
                    </button>
                  </div>
                )}

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-[#E4E7EC]">
                    {/* sandbox="" blocks scripts and forms, so the preview can never run code. */}
                    <iframe
                      title={`Preview of ${newsletter.name}`}
                      sandbox=""
                      srcDoc={newsletter.compiledHtml}
                      className="w-full h-[640px] rounded-md border border-[#E4E7EC] bg-white"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Pagination currentPage={page} totalPages={pagination.totalPages} onPageChange={(p) => load(p)} />
    </div>
  )
}