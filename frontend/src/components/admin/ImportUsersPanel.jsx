import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import userService from '../../services/userService'

const POLL_MS = 1500

function Stat({ label, value, tone = 'text-[#1B2340]' }) {
  return (
    <div className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

export default function ImportUsersPanel({ open, onClose, onFinished }) {
  const [step, setStep] = useState('select') // select | preview | running | done
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  const stopPolling = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const reset = () => {
    stopPolling()
    setStep('select')
    setFile(null)
    setPreview(null)
    setStatus(null)
    setBusy(false)
    setError('')
  }

  useEffect(() => () => stopPolling(), [])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleDownloadTemplate = async () => {
    try {
      const blob = await userService.downloadImportTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'faculty-import-template.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error('Could not download the template')
    }
  }

  const chooseFile = async (f) => {
    if (!f) return
    if (!/\.xlsx$/i.test(f.name)) {
      setError('Please choose an .xlsx Excel file.')
      return
    }
    setError('')
    setFile(f)
    setBusy(true)
    try {
      const res = await userService.previewImport(f)
      setPreview(res.data)
      setStep('preview')
    } catch (err) {
      setFile(null)
      setError(err.response?.data?.message || 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  const poll = (batchId) => {
    stopPolling()
    timerRef.current = setInterval(async () => {
      try {
        const res = await userService.importStatus(batchId)
        setStatus(res.data)
        if (res.data.done) {
          stopPolling()
          setStep('done')
          onFinished?.()
        }
      } catch (err) {
        stopPolling()
        setError('Lost track of the import. Check the Users page to see what was created.')
        setStep('done')
        onFinished?.()
      }
    }, POLL_MS)
  }

  const startImport = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await userService.startImport(file)
      setStatus({ ...res.data, created: 0, failed: 0, emailed: 0, emailFailed: 0, failures: [], emailFailures: [], done: false })
      setStep('running')
      poll(res.data.batchId)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start the import.')
    } finally {
      setBusy(false)
    }
  }

  // Removing a problem row only hides it here: rows with problems are never
  // imported anyway, so this just clears the list.
  const removeProblem = (rowNumber) =>
    setPreview((p) => {
      const invalid = p.invalid.filter((r) => r.rowNumber !== rowNumber)
      return { ...p, invalid, invalidCount: invalid.length }
    })
  const clearProblems = () => setPreview((p) => ({ ...p, invalid: [], invalidCount: 0 }))

  const processed = status ? status.created + status.failed : 0
  const pct = status && status.total ? Math.round((processed / status.total) * 100) : 0

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#101828]/40" onClick={onClose} />
      <div className="relative bg-[#F5F6F8] w-full max-w-[760px] max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 bg-white border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-[#1B2340]">Import faculty from Excel</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Each person gets their college email as username and a one-time password by email.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-[#1B2340] text-xl leading-none" aria-label="Close">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>
          )}

          {step === 'select' && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); chooseFile(e.dataTransfer.files?.[0]) }}
                onClick={() => !busy && inputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
                  dragOver ? 'border-[#C9962C] bg-[#C9962C]/5' : 'border-gray-300 bg-white hover:border-[#C9962C]/60'
                }`}
              >
                <p className="text-[#1B2340] font-medium">
                  {busy ? 'Checking your file…' : 'Drop your Excel file here, or click to choose'}
                </p>
                <p className="text-xs text-gray-400 mt-1">.xlsx, up to 1000 rows</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => { chooseFile(e.target.files?.[0]); e.target.value = '' }}
                />
              </div>
              <div className="rounded-lg bg-white border border-gray-200 p-4 text-sm text-gray-600 space-y-2">
                <p className="font-medium text-[#1B2340]">Not sure how the file should look?</p>
                <p>
                  Columns: <b>Name</b>, <b>Email</b> (required), Phone, Designation, Employee ID, Department.
                  Roles, clusters and sections are assigned afterwards.
                </p>
                <button onClick={handleDownloadTemplate} className="text-[#C9962C] font-medium hover:underline">
                  Download the template
                </button>
              </div>
            </>
          )}

          {step === 'preview' && preview && (
            <>
              <div className="flex gap-3">
                <Stat label="Rows in file" value={preview.total} />
                <Stat label="Ready to import" value={preview.validCount} tone="text-green-700" />
                <Stat label="Problem rows (skipped)" value={preview.invalid.length} tone={preview.invalid.length ? 'text-red-600' : 'text-gray-400'} />
              </div>

              {preview.invalid.length > 0 && (
                <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-red-50 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-red-700">
                      Rows with problems. Remove them here to skip them, or fix them in Excel and upload again.
                    </span>
                    <button
                      type="button"
                      onClick={clearProblems}
                      className="shrink-0 text-xs font-semibold text-red-700 border border-red-200 bg-white rounded-md px-2.5 py-1 hover:bg-red-100"
                    >
                      Remove all
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-gray-500 bg-gray-50">
                        <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Person</th><th className="px-3 py-2">Problem</th><th className="px-3 py-2 w-8" /></tr>
                      </thead>
                      <tbody>
                        {preview.invalid.map((r) => (
                          <tr key={r.rowNumber} className="border-t border-gray-100 align-top">
                            <td className="px-3 py-2 text-gray-500">{r.rowNumber}</td>
                            <td className="px-3 py-2">
                              <div className="text-[#1B2340]">{r.name || '—'}</div>
                              <div className="text-xs text-gray-400">{r.email}</div>
                            </td>
                            <td className="px-3 py-2 text-red-600">{r.errors.join('; ')}</td>
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeProblem(r.rowNumber)}
                                aria-label={`Remove row ${r.rowNumber}`}
                                title="Remove this row"
                                className="w-6 h-6 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {preview.sample.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 text-sm font-medium text-[#1B2340]">
                    Will be imported{preview.validCount > preview.sample.length ? ` (first ${preview.sample.length} shown)` : ''}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-gray-500">
                        <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Department</th></tr>
                      </thead>
                      <tbody>
                        {preview.sample.map((r) => (
                          <tr key={r.rowNumber} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-[#1B2340]">
                              {r.name}
                              {r.designation && <div className="text-xs text-gray-400">{r.designation}</div>}
                            </td>
                            <td className="px-3 py-2">{r.email}</td>
                            <td className="px-3 py-2 text-gray-500">{r.department || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500">
                New accounts start with no role. Each person is emailed their username and a temporary password
                that works once and expires in 7 days.
              </p>
            </>
          )}

          {(step === 'running' || step === 'done') && status && (
            <>
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-[#1B2340]">
                    {step === 'done' ? 'Import finished' : 'Importing and sending emails…'}
                  </span>
                  <span className="text-gray-500">{processed} / {status.total}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#C9962C] to-[#E0B563] transition-all" style={{ width: `${pct}%` }} />
                </div>
                {step === 'running' && (
                  <p className="text-xs text-gray-400 mt-3">
                    You can close this panel — the import keeps running in the background.
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <Stat label="Accounts created" value={status.created} tone="text-green-700" />
                <Stat label="Emails sent" value={status.emailed} tone="text-green-700" />
                <Stat label="Emails failed" value={status.emailFailed} tone={status.emailFailed ? 'text-amber-600' : 'text-gray-400'} />
                <Stat label="Not created" value={status.failed} tone={status.failed ? 'text-red-600' : 'text-gray-400'} />
              </div>

              {status.emailFailures?.length > 0 && (
                <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-amber-50 text-sm font-medium text-amber-700">
                    Accounts exist but the email failed — use “Resend” next to them on the Users page
                  </div>
                  <ul className="max-h-48 overflow-y-auto text-sm divide-y divide-gray-100">
                    {status.emailFailures.map((f) => (
                      <li key={f.email} className="px-4 py-2"><span className="text-[#1B2340]">{f.email}</span> <span className="text-xs text-gray-400">— {f.reason}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {status.failures?.length > 0 && (
                <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-red-50 text-sm font-medium text-red-700">Could not be created</div>
                  <ul className="max-h-48 overflow-y-auto text-sm divide-y divide-gray-100">
                    {status.failures.map((f) => (
                      <li key={f.email} className="px-4 py-2"><span className="text-[#1B2340]">{f.email}</span> <span className="text-xs text-gray-400">— {f.reason}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {step === 'done' && (
                <p className="text-xs text-gray-500">
                  Next: open the <b>Guests</b> tab on the Users page and assign each person a role, department, cluster and section.
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end gap-2">
          {step === 'preview' && (
            <>
              <button onClick={reset} disabled={busy} className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
                Choose another file
              </button>
              <button
                onClick={startImport}
                disabled={busy || !preview?.validCount}
                className="px-4 py-2 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold disabled:opacity-50"
              >
                {busy ? 'Starting…' : `Import ${preview?.validCount || 0} faculty`}
              </button>
            </>
          )}
          {step === 'done' && (
            <>
              <button onClick={reset} className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
                Import another file
              </button>
              <button onClick={onClose} className="px-4 py-2 rounded-md bg-[#1B2340] text-white text-sm font-semibold">
                Done
              </button>
            </>
          )}
          {(step === 'select' || step === 'running') && (
            <button onClick={onClose} className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
              Close
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}