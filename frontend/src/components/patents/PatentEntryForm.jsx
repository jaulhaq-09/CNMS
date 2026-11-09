import React, { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, X } from 'lucide-react'
import usePermissions from '../../hooks/usePermissions'
import { PERMISSIONS } from '../../config/permissions'
import patentService from '../../services/patentService'
import departmentService from '../../services/departmentService'
import { Field, Section, inputClass } from '../report/formKit'
import { DraftRestoredBanner } from '../../hooks/useFormDraft'

const STATUSES = [
  { value: 'APPLIED', label: 'Applied', hint: 'Filed, not yet published' },
  { value: 'PUBLISHED', label: 'Published', hint: 'Published by the office' },
  { value: 'GRANTED', label: 'Granted', hint: 'Patent granted' },
]

const EMPTY = {
  title: '',
  grantingAuthority: '',
  grantStatus: 'APPLIED',
  patentNumber: '',
  filingDate: '',
  grantDate: '',
}

function validate(form, inventors, departmentId, clusterRequired, cluster) {
  const e = {}
  const clean = inventors.map((i) => i.trim()).filter(Boolean)

  if (!form.title.trim()) e.title = 'Required.'
  else if (form.title.trim().length > 500) e.title = 'Keep it under 500 characters.'

  if (clean.length === 0) e.inventors = 'Add at least one inventor.'
  else {
    const seen = new Set()
    for (const name of clean) {
      const key = name.toLowerCase()
      if (seen.has(key)) {
        e.inventors = `“${name}” is listed twice.`
        break
      }
      seen.add(key)
    }
  }

  if (!form.grantingAuthority.trim()) e.grantingAuthority = 'Required.'
  if (!departmentId) e.department = 'Select a department.'
  if (clusterRequired && !cluster) e.cluster = 'Select a cluster.'

  if (form.grantStatus === 'GRANTED') {
    if (!form.grantDate) e.grantDate = 'Required for a granted patent.'
    else if (form.filingDate && form.grantDate < form.filingDate) e.grantDate = 'Granted before it was filed.'
  }
  return e
}

/**
 * Standalone mode: creates + submits the patent (used by /post-patent).
 * Collect mode (onCollect given): hands the finished payload back to the
 * monthly report wizard instead of calling the API.
 */
export default function PatentEntryForm({ onPosted, onCollect, initial, onCancel }) {
  const { can, scope } = usePermissions()
  const clusters = scope.clusters || []

  const [form, setForm] = useState(initial?.form || EMPTY)
  const [inventors, setInventors] = useState(initial?.inventors || [''])
  const [department, setDepartment] = useState('')
  // One cluster: chosen automatically. Several: the person picks.
  const [cluster, setCluster] = useState(clusters.length === 1 ? clusters[0] : '')
  const [departments, setDepartments] = useState([])
  const [touched, setTouched] = useState({})
  const [attempted, setAttempted] = useState(false)
  const [verified, setVerified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [draftRestored, setDraftRestored] = useState(false)

  const draftKey = 'cnms_draft_patent'

  // Restore draft if editing new entry
  useEffect(() => {
    if (initial) return
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.form && parsed.form.title) {
          setForm(parsed.form)
          if (Array.isArray(parsed.inventors) && parsed.inventors.length > 0) setInventors(parsed.inventors)
          setDraftRestored(true)
        }
      }
    } catch (e) {
      // ignore
    }
  }, [initial])

  // Auto-save draft
  useEffect(() => {
    if (initial) return
    if (!form.title && !form.grantingAuthority && inventors.every((i) => !i)) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ form, inventors }))
      } catch (e) {
        // ignore
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [form, inventors, initial])

  const clearPatentDraft = () => {
    try {
      localStorage.removeItem(draftKey)
      setDraftRestored(false)
      setForm(EMPTY)
      setInventors([''])
    } catch (e) {
      // ignore
    }
  }

  const inventorRefs = useRef([])
  const pendingFocus = useRef(null)

  const departmentId = scope.departmentId || department

  useEffect(() => {
    if (pendingFocus.current !== null) {
      inventorRefs.current[pendingFocus.current]?.focus()
      pendingFocus.current = null
    }
  }, [inventors])

  // Only accounts without their own department (e.g. super admin) pick one.
  useEffect(() => {
    if (scope.departmentId) return
    departmentService
      .getAll()
      .then((res) => setDepartments(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setDepartments([]))
  }, [scope.departmentId])

  const cleanInventors = useMemo(() => inventors.map((i) => i.trim()).filter(Boolean), [inventors])
  const errors = useMemo(
    () => validate(form, inventors, departmentId, clusters.length > 1, cluster),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, inventors, departmentId, cluster, clusters.length]
  )
  const errorCount = Object.keys(errors).length

  if (!can(PERMISSIONS.EVENTS_CREATE)) {
    return (
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 text-sm text-[#667085]">
        You don&apos;t have permission to submit patents.
      </div>
    )
  }

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  const blur = (field) => () => setTouched((prev) => ({ ...prev, [field]: true }))
  const show = (field) => (attempted || touched[field] ? errors[field] : '')

  const updateInventor = (index) => (e) =>
    setInventors((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))
  const addInventor = () => {
    pendingFocus.current = inventors.length
    setInventors([...inventors, ''])
  }
  const removeInventor = (index) => setInventors((prev) => prev.filter((_, i) => i !== index))
  const onInventorKeyDown = (index) => (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!inventors[index].trim()) return
    if (index === inventors.length - 1) addInventor()
    else inventorRefs.current[index + 1]?.focus()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setAttempted(true)

    if (errorCount > 0) {
      setError(`Please fix the ${errorCount} highlighted field${errorCount > 1 ? 's' : ''}.`)
      return
    }
    if (!onCollect && !verified) {
      setError('Please confirm you have verified these details before submitting.')
      return
    }

    const payload = {
      title: form.title.trim(),
      department: departmentId,
      cluster: cluster || undefined,
      inventors: cleanInventors,
      grantingAuthority: form.grantingAuthority.trim(),
      grantStatus: form.grantStatus,
      patentNumber: form.patentNumber.trim() || undefined,
      filingDate: form.filingDate || undefined,
      grantDate: form.grantStatus === 'GRANTED' ? form.grantDate || undefined : undefined,
    }

    if (onCollect) {
      const label = STATUSES.find((s) => s.value === form.grantStatus)?.label
      onCollect({
        payload,
        raw: { form, inventors },
        title: payload.title,
        detail: `${payload.grantingAuthority} · ${label}`,
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await patentService.create(payload)
      await patentService.submit(response.data._id)

      clearPatentDraft()
      setForm(EMPTY)
      setInventors([''])
      setTouched({})
      setAttempted(false)
      setVerified(false)
      toast.success('Patent submitted for review')
      onPosted?.(response.data)
    } catch (err) {
      const details = err.response?.data?.errors
      const message =
        Array.isArray(details) && details.length > 0
          ? details.map((d) => d.message).join(' ')
          : err.response?.data?.message || 'Could not submit the patent.'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white border border-[#E4E7EC] rounded-lg p-6 space-y-5 animate-[fadeInUp_0.2s_ease-out]"
    >
      {draftRestored && (
        <DraftRestoredBanner
          onClear={clearPatentDraft}
          message="Your in-progress patent details were restored from your previous session."
        />
      )}
      <Section title="Patent details">
        <div className="space-y-4">
          <Field label="Patent title" htmlFor="pat-title" error={show('title')}>
            <input
              id="pat-title"
              type="text"
              value={form.title}
              onChange={update('title')}
              onBlur={blur('title')}
              className={inputClass(show('title'))}
            />
          </Field>

          {!scope.departmentId && (
            <Field label="Department" htmlFor="pat-dept" error={show('department')}>
              <select
                id="pat-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                onBlur={blur('department')}
                className={inputClass(show('department'))}
              >
                <option value="">Select a department</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </Field>
          )}

          {clusters.length > 1 && (
            <Field label="Cluster" htmlFor="pat-cluster" error={show('cluster')}>
              <select
                id="pat-cluster"
                value={cluster}
                onChange={(e) => setCluster(e.target.value)}
                onBlur={blur('cluster')}
                className={inputClass(show('cluster'))}
              >
                <option value="">Select a cluster</option>
                {clusters.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}

          <div>
            <p className="block text-sm font-medium text-[#1B2340] mb-1.5">Inventor(s)</p>
            <div className="space-y-2">
              {inventors.map((inv, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-6 text-xs text-[#98A2B3] text-right shrink-0">{index + 1}.</span>
                  <input
                    ref={(el) => (inventorRefs.current[index] = el)}
                    type="text"
                    aria-label={`Inventor ${index + 1}`}
                    placeholder="Inventor name"
                    value={inv}
                    onChange={updateInventor(index)}
                    onKeyDown={onInventorKeyDown(index)}
                    onBlur={blur('inventors')}
                    className={inputClass(false)}
                  />
                  {inventors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInventor(index)}
                      aria-label="Remove inventor"
                      className="p-1.5 rounded text-[#98A2B3] hover:text-[#B42318] hover:bg-[#FEF3F2] shrink-0"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {show('inventors') && <p className="text-xs text-[#B42318] mt-1.5">{show('inventors')}</p>}
            <button
              type="button"
              onClick={addInventor}
              className="mt-2 inline-flex items-center gap-1 text-xs text-[#C9962C] font-medium hover:underline"
            >
              <Plus size={13} /> Add inventor
            </button>
          </div>

          <Field label="Granting authority" htmlFor="pat-authority" error={show('grantingAuthority')}>
            <input
              id="pat-authority"
              type="text"
              value={form.grantingAuthority}
              onChange={update('grantingAuthority')}
              onBlur={blur('grantingAuthority')}
              placeholder="e.g. Intellectual Property Office of India"
              className={inputClass(show('grantingAuthority'))}
            />
          </Field>
        </div>
      </Section>

      <Section title="Status and dates">
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Patent status" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {STATUSES.map((s) => {
              const selected = form.grantStatus === s.value
              return (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setForm((prev) => ({ ...prev, grantStatus: s.value }))}
                  className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    selected ? 'border-[#C9962C] bg-[#C9962C]/10' : 'border-[#E4E7EC] hover:bg-[#F5F6F8]'
                  }`}
                >
                  <span className="block text-sm font-medium text-[#1B2340]">{s.label}</span>
                  <span className="block text-[11px] text-[#667085] mt-0.5">{s.hint}</span>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Patent / application number (optional)" htmlFor="pat-number">
              <input
                id="pat-number"
                type="text"
                value={form.patentNumber}
                onChange={update('patentNumber')}
                className={inputClass(false)}
              />
            </Field>
            <Field label="Filing date (optional)" htmlFor="pat-filing">
              <input
                id="pat-filing"
                type="date"
                value={form.filingDate}
                onChange={update('filingDate')}
                className={inputClass(false)}
              />
            </Field>
          </div>

          {form.grantStatus === 'GRANTED' && (
            <Field label="Grant date" htmlFor="pat-grant" error={show('grantDate')}>
              <input
                id="pat-grant"
                type="date"
                value={form.grantDate}
                onChange={update('grantDate')}
                onBlur={blur('grantDate')}
                className={inputClass(show('grantDate'))}
              />
            </Field>
          )}
        </div>
      </Section>

      {!onCollect && (
        <div className="bg-[#F5F6F8] rounded-md p-3">
          <label className="flex items-start gap-2 text-xs text-[#334155]">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="mt-0.5"
            />
            I confirm I have verified these details before submitting.
          </label>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || (!onCollect && !verified)}
          className="px-5 py-2.5 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {onCollect ? (initial ? 'Save changes' : 'Add patent') : submitting ? 'Submitting...' : 'Submit patent'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8]"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}