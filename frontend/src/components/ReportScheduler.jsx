import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import reportService from '../services/reportService'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_RECIPIENTS = 20

const FREQUENCY_LABELS = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const newSchedule = () => ({
  frequency: 'WEEKLY',
  dayOfWeek: 1,
  dayOfMonth: 1,
  time: '09:00',
  recipients: [],
})

export default function ReportScheduler({ reports, onChanged }) {
  const [selectedId, setSelectedId] = useState('')
  const [schedule, setSchedule] = useState(newSchedule())
  const [recipientEmail, setRecipientEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const user = useSelector((state) => state.auth?.user)

  // Look the report up by id every render, so it stays fresh after the list reloads.
  const selectedReport = reports.find((r) => r._id === selectedId) || null
  const current = selectedReport?.scheduling?.enabled ? selectedReport.scheduling : null

  // When a different report is picked, load its existing schedule into the form.
  useEffect(() => {
    const s = selectedReport?.scheduling
    setSchedule(
      s?.frequency
        ? {
          frequency: s.frequency,
          dayOfWeek: s.dayOfWeek ?? 1,
          dayOfMonth: s.dayOfMonth ?? 1,
          time: s.time || '09:00',
          recipients: [...(s.recipients || [])],
        }
        : newSchedule()
    )
    setRecipientEmail('')
    setError(null)
    setConfirmCancel(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const addRecipient = () => {
    const email = recipientEmail.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (schedule.recipients.includes(email)) {
      setRecipientEmail('')
      return
    }
    if (schedule.recipients.length >= MAX_RECIPIENTS) {
      setError(`You can add up to ${MAX_RECIPIENTS} recipients.`)
      return
    }
    setError(null)
    setSchedule({ ...schedule, recipients: [...schedule.recipients, email] })
    setRecipientEmail('')
  }

  const removeRecipient = (email) => {
    setSchedule({ ...schedule, recipients: schedule.recipients.filter((e) => e !== email) })
  }

  const handleSchedule = async () => {
    if (!selectedReport) {
      setError('Please select a report.')
      return
    }
    if (recipientEmail.trim()) {
      setError('Click "Add" to include the email you typed, or clear the box.')
      return
    }
    if (schedule.recipients.length === 0) {
      setError('Add at least one recipient.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await reportService.schedule(selectedReport._id, schedule)
      toast.success(current ? 'Schedule updated' : 'Report scheduled')
      if (onChanged) onChanged()
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to schedule report'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSchedule = async () => {
    try {
      setLoading(true)
      setError(null)
      await reportService.unschedule(selectedReport._id)
      toast.success('Schedule cancelled')
      setConfirmCancel(false)
      if (onChanged) onChanged()
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to cancel schedule'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendTest = async () => {
    try {
      setSendingTest(true)
      setError(null)
      const res = await reportService.emailMe(selectedReport._id)
      toast.success(res.message || 'Test report sent')
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to send test report'
      setError(message)
      toast.error(message)
    } finally {
      setSendingTest(false)
    }
  }
  if (!reports || reports.length === 0) {
    return (
      <div className="bg-white border border-dashed border-[#E4E7EC] rounded-xl py-16 px-6 text-center max-w-2xl">
        <p className="font-serif font-semibold text-lg text-[#1B2340] mb-1">No reports to schedule</p>
        <p className="text-sm text-[#667085]">
          Build a report first in the "Build Report" tab, then come back here to have it emailed on a schedule.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 max-w-2xl space-y-5">
      <div>
        <h2 className="font-serif font-semibold text-lg text-[#1B2340]">Schedule Reports</h2>
        <p className="text-sm text-[#667085] mt-1">
          Have a saved report generated and emailed automatically.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="select-report" className="block text-sm font-medium text-[#1B2340] mb-1.5">
          Select Report
        </label>
        <select
          id="select-report"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
        >
          <option value="">— Choose a report —</option>
          {reports.map((report) => (
            <option key={report._id} value={report._id}>
              {report.name}
              {report.scheduling?.enabled ? '  ● scheduled' : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedReport && current && (
        <div className="rounded-lg border border-[#ABEFC6] bg-[#ECFDF3] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#067647]">Currently scheduled</p>
            <p className="text-sm text-[#344054] mt-0.5">
              {FREQUENCY_LABELS[current.frequency] || current.frequency} at {current.time} &middot;{' '}
              {(current.recipients || []).length} recipient{(current.recipients || []).length !== 1 ? 's' : ''}
            </p>
          </div>

          {!confirmCancel ? (
            <button
              onClick={() => setConfirmCancel(true)}
              disabled={loading}
              className="px-3.5 py-2 rounded-md border border-[#E4E7EC] bg-white text-sm text-[#667085] hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-60"
            >
              Cancel schedule
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#344054]">Stop emailing this report?</span>
              <button
                onClick={handleCancelSchedule}
                disabled={loading}
                className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {loading ? 'Cancelling…' : 'Yes, cancel'}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                disabled={loading}
                className="px-3 py-1.5 rounded-md border border-[#E4E7EC] bg-white text-sm text-[#667085] hover:bg-[#F5F6F8] transition-colors"
              >
                Keep
              </button>
            </div>
          )}
        </div>
      )}

      {selectedReport && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="frequency" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                Frequency
              </label>
              <select
                id="frequency"
                value={schedule.frequency}
                onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
              >
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="schedule-time" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                Time
              </label>
              <input
                id="schedule-time"
                type="time"
                value={schedule.time}
                onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
            </div>
          </div>
                    {schedule.frequency === 'WEEKLY' && (
            <div>
              <label htmlFor="schedule-day" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                Day of the week
              </label>
              <select
                id="schedule-day"
                value={schedule.dayOfWeek}
                onChange={(e) => setSchedule({ ...schedule, dayOfWeek: Number(e.target.value) })}
                className="w-full sm:w-1/2 px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
              >
                {DAY_NAMES.map((day, i) => (
                  <option key={day} value={i}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          )}

          {['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(schedule.frequency) && (
            <div>
              <label htmlFor="schedule-date" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                Day of the month
              </label>
              <select
                id="schedule-date"
                value={schedule.dayOfMonth}
                onChange={(e) => setSchedule({ ...schedule, dayOfMonth: Number(e.target.value) })}
                className="w-full sm:w-1/2 px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[#98A2B3] mt-1.5">
                {schedule.frequency === 'MONTHLY' && 'Days 1–28 only, so every month has the date.'}
                {schedule.frequency === 'QUARTERLY' && 'Runs in January, April, July and October.'}
                {schedule.frequency === 'YEARLY' && 'Runs once a year, in January.'}
              </p>
            </div>
          )}
          <div>
            <label htmlFor="recipient-email" className="block text-sm font-medium text-[#1B2340] mb-1.5">
              Recipients
            </label>
            <div className="flex gap-2">
              <input
                id="recipient-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addRecipient()
                  }
                }}
                placeholder="email@example.com"
                className="flex-1 px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
              <button
                type="button"
                onClick={addRecipient}
                className="px-4 py-2 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8] transition-colors"
              >
                Add
              </button>
            </div>

            {schedule.recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {schedule.recipients.map((email) => (
                  <span
                    key={email}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F6F8] text-xs text-[#334155]"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeRecipient(email)}
                      className="text-[#98A2B3] hover:text-red-600"
                      aria-label={`Remove ${email}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs text-[#98A2B3] mt-2">
              Everyone listed here receives the generated report as an email attachment each time it runs. Only add
              people who should see this data.
            </p>
          </div>


          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSchedule}
              disabled={loading || sendingTest}
              className="px-5 py-2.5 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold hover:brightness-105 transition-all disabled:opacity-60"
            >
              {loading ? 'Saving…' : current ? 'Update Schedule' : 'Schedule Report'}
            </button>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={loading || sendingTest}
              title={user?.email ? `Sends a copy to ${user.email}` : undefined}
              className="px-4 py-2.5 rounded-md border border-[#E4E7EC] text-sm text-[#1B2340] hover:border-[#C9962C] hover:text-[#C9962C] transition-colors disabled:opacity-60"
            >
              {sendingTest ? 'Sending…' : 'Email me a test copy'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}