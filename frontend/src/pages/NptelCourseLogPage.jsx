import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Award, BookOpen, Calendar, Download, GraduationCap, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react'
import nptelService from '../services/nptelService'
import Pagination from '../components/common/Pagination'
import { formatDate } from '../utils/date'
import { Field, inputClass } from '../components/report/formKit'
import { useFormDraft, DraftRestoredBanner } from '../hooks/useFormDraft'

const PAGE_SIZE = 10
const PLATFORMS = [
  'NPTEL',
  'SWAYAM',
  'Coursera',
  'Udemy',
  'edX',
  'LinkedIn Learning',
  'Great Learning',
  'Simplilearn',
  'Microsoft Learn',
  'Google Cloud Skills',
  'AWS Training',
  'HackerRank / LeetCode',
  'Other',
]
const DURATIONS = ['4 weeks', '8 weeks', '12 weeks']

const EMPTY = {
  courseName: '',
  platform: 'NPTEL',
  customPlatform: '',
  duration: '',
  startDate: '',
  completionDate: '',
  certificateEarned: false,
  score: '',
}

const iso = (d) => (d ? String(d).slice(0, 10) : '')
const facultyName = (c) => (c.faculty ? `${c.faculty.firstName || ''} ${c.faculty.lastName || ''}`.trim() : '—')
const initialsOf = (c) =>
  c.faculty ? `${c.faculty.firstName?.[0] || ''}${c.faculty.lastName?.[0] || ''}`.toUpperCase() : '?'
const yearOf = (c) => (c.completionDate ? new Date(c.completionDate).getFullYear() : null)

// The API pages its results; pull every page so filters and totals are accurate.
async function fetchAll() {
  const first = await nptelService.getAll({}, 1, 100)
  let all = first.data || []
  const total = first.pagination?.totalPages || 1
  for (let p = 2; p <= total && p <= 20; p++) {
    const res = await nptelService.getAll({}, p, 100)
    all = all.concat(res.data || [])
  }
  return all
}

function validate(form) {
  const e = {}
  if (!form.courseName.trim()) e.courseName = 'Required.'
  else if (form.courseName.trim().length > 300) e.courseName = 'Keep it under 300 characters.'
  if (form.startDate && form.completionDate && form.completionDate < form.startDate) {
    e.completionDate = 'Completed before it started.'
  }
  if (form.certificateEarned && !form.completionDate) {
    e.completionDate = 'Add the completion date for a certified course.'
  }
  return e
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="bg-white border border-[#E4E7EC] rounded-xl px-4 py-3.5 flex items-center gap-3">
      <span className="w-9 h-9 rounded-lg bg-[#C9962C]/10 text-[#B07C1F] flex items-center justify-center shrink-0">
        <Icon size={17} />
      </span>
      <div>
        <p className="text-xl font-serif font-semibold text-[#1B2340] leading-none">{value}</p>
        <p className="text-[11px] uppercase tracking-wide text-[#667085] mt-1">{label}</p>
      </div>
    </div>
  )
}

function CourseDrawer({ course, onClose, onSaved }) {
  const editing = Boolean(course?._id)
  const isKnownPlatform = course?.platform && PLATFORMS.includes(course.platform)
  const authUser = useSelector((state) => state.auth?.user)
  const initial = useMemo(
    () =>
      editing
        ? {
            courseName: course.courseName || '',
            platform: isKnownPlatform ? course.platform : course.platform ? 'Other' : 'NPTEL',
            customPlatform: !isKnownPlatform && course?.platform ? course.platform : '',
            duration: course.duration || '',
            startDate: iso(course.startDate),
            completionDate: iso(course.completionDate),
            certificateEarned: Boolean(course.certificateEarned || course.certificateUrl),
            score: course.score || '',
            certificateUrl: course.certificateUrl || '',
            certificateFileName: course.certificateFileName || '',
          }
        : EMPTY,
    [course, editing, isKnownPlatform]
  )
  const [form, setForm] = useState(initial)
  const [certificateFile, setCertificateFile] = useState(null)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)

  const draftKey = !editing ? `cnms_draft_nptel_${authUser?._id || authUser?.id || 'anon'}` : null
  const { draftRestored, clearDraft } = useFormDraft(draftKey, form, setForm)

  const errors = validate(form)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || Boolean(certificateFile)

  const requestClose = () => {
    if (dirty && !window.confirm('Discard your changes?')) return
    onClose()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleCertificateChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error('Certificate must be under 15MB.')
        return
      }
      setCertificateFile(file)
      setForm((prev) => ({ ...prev, certificateEarned: true }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAttempted(true)
    if (Object.keys(errors).length > 0) return

    const effectivePlatform =
      form.platform === 'Other'
        ? (form.customPlatform?.trim() || 'Other')
        : (form.platform?.trim() || 'NPTEL')

    setSaving(true)
    try {
      if (certificateFile) {
        const formData = new FormData()
        formData.append('courseName', form.courseName.trim())
        formData.append('platform', effectivePlatform)
        formData.append('certificateEarned', 'true')
        if (form.duration?.trim()) formData.append('duration', form.duration.trim())
        if (form.score?.trim()) formData.append('score', form.score.trim())
        if (form.startDate) formData.append('startDate', form.startDate)
        if (form.completionDate) formData.append('completionDate', form.completionDate)
        formData.append('certificate', certificateFile)

        if (editing) await nptelService.update(course._id, formData)
        else await nptelService.create(formData)
      } else {
        const payload = {
          courseName: form.courseName.trim(),
          platform: effectivePlatform,
          certificateEarned: form.certificateEarned,
        }
        const blank = editing ? null : undefined
        payload.duration = form.duration?.trim() || blank
        payload.score = form.score?.trim() || blank
        payload.startDate = form.startDate || blank
        payload.completionDate = form.completionDate || blank

        if (editing) await nptelService.update(course._id, payload)
        else await nptelService.create(payload)
      }

      if (clearDraft) clearDraft()
      toast.success(editing ? 'Course updated' : 'Course logged')
      onSaved()
    } catch (err) {
      const details = err.response?.data?.errors
      toast.error(
        Array.isArray(details) && details.length
          ? details.map((d) => d.message).join(' ')
          : err.response?.data?.message || 'Could not save this course.'
      )
    } finally {
      setSaving(false)
    }
  }

  const show = (f) => (attempted ? errors[f] : '')

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-[#101828]/40 backdrop-blur-[1px]" onClick={requestClose} />
      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative ml-auto h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-[fadeInUp_0.2s_ease-out]"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#E4E7EC]">
          <div>
            <h3 className="font-serif font-semibold text-xl text-[#1B2340]">
              {editing ? 'Edit course' : 'Log a course'}
            </h3>
            <p className="text-xs text-[#667085] mt-0.5">NPTEL, Coursera, Udemy, and other development courses.</p>
          </div>
          <button type="button" onClick={requestClose} aria-label="Close" className="p-1.5 rounded text-[#667085] hover:bg-[#F5F6F8]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {draftRestored && (
            <DraftRestoredBanner
              onClear={() => {
                clearDraft()
                setForm(EMPTY)
              }}
            />
          )}
          <Field label="Course name" htmlFor="nc-name" error={show('courseName')}>
            <input
              id="nc-name"
              autoFocus
              value={form.courseName}
              onChange={set('courseName')}
              placeholder="e.g. Data Structures and Algorithms"
              className={inputClass(show('courseName'))}
            />
          </Field>

          <Field label="Platform" htmlFor="nc-platform">
            <select
              id="nc-platform"
              value={form.platform}
              onChange={set('platform')}
              className={inputClass(false)}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          {form.platform === 'Other' && (
            <Field label="Specify Platform Name" htmlFor="nc-custom-platform">
              <input
                id="nc-custom-platform"
                value={form.customPlatform || ''}
                onChange={set('customPlatform')}
                placeholder="e.g. edX / Pluralsight / University"
                className={inputClass(false)}
              />
            </Field>
          )}

          <div>
            <Field label="Duration (optional)" htmlFor="nc-duration">
              <input
                id="nc-duration"
                value={form.duration}
                onChange={set('duration')}
                placeholder="e.g. 8 weeks"
                className={inputClass(false)}
              />
            </Field>
            <div className="flex gap-2 mt-2 flex-wrap">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, duration: d }))}
                  className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
                    form.duration === d
                      ? 'border-[#1B2340] bg-[#1B2340] text-white'
                      : 'border-[#E4E7EC] text-[#475467] hover:bg-[#F5F6F8]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date (optional)" htmlFor="nc-start">
              <input id="nc-start" type="date" value={form.startDate} onChange={set('startDate')} className={inputClass(false)} />
            </Field>
            <Field label="Completion date" htmlFor="nc-end" error={show('completionDate')}>
              <input
                id="nc-end"
                type="date"
                value={form.completionDate}
                onChange={set('completionDate')}
                className={inputClass(show('completionDate'))}
              />
            </Field>
          </div>

          <Field label="Score / grade (optional)" htmlFor="nc-score">
            <input
              id="nc-score"
              value={form.score}
              onChange={set('score')}
              placeholder="e.g. 82% or Elite + Gold"
              className={inputClass(false)}
            />
          </Field>

          <button
            type="button"
            role="switch"
            aria-checked={form.certificateEarned}
            onClick={() => setForm((prev) => ({ ...prev, certificateEarned: !prev.certificateEarned }))}
            className={`w-full flex items-center justify-between gap-3 rounded-lg border p-3.5 text-left transition-colors ${
              form.certificateEarned ? 'border-[#C9962C] bg-[#C9962C]/10' : 'border-[#E4E7EC] hover:bg-[#F5F6F8]'
            }`}
          >
            <span>
              <span className="block text-sm font-medium text-[#1B2340]">Certificate earned</span>
              <span className="block text-xs text-[#667085] mt-0.5">Turn on if you passed and received a certificate.</span>
            </span>
            <span className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${form.certificateEarned ? 'bg-[#C9962C]' : 'bg-[#D0D5DD]'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${form.certificateEarned ? 'translate-x-4' : ''}`} />
            </span>
          </button>

          {/* Certificate attachment */}
          {form.certificateEarned && (
            <div className="p-4 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#1B2340] flex items-center gap-1.5">
                  <Award size={16} className="text-[#C9962C]" />
                  Attach Certificate
                </span>
                <span className="text-[11px] text-[#667085]">PDF, PNG, JPG (max 15MB)</span>
              </div>

              {form.certificateUrl && !certificateFile && (
                <div className="flex items-center justify-between p-2.5 rounded bg-white border border-[#E4E7EC] text-xs">
                  <span className="truncate max-w-[200px] text-[#475467] font-medium">
                    {form.certificateFileName || 'Uploaded Certificate'}
                  </span>
                  <a
                    href={form.certificateUrl.startsWith('http') ? form.certificateUrl : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}${form.certificateUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#C9962C] font-semibold hover:underline"
                  >
                    View Current
                  </a>
                </div>
              )}

              <input
                id="nc-certificate-file"
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                onChange={handleCertificateChange}
                className="block w-full text-xs text-[#667085] file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#1B2340] file:text-white hover:file:bg-[#2C3860] cursor-pointer"
              />

              {certificateFile && (
                <p className="text-xs text-[#067647] flex items-center gap-1">
                  Selected: {certificateFile.name} ({(certificateFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#E4E7EC] bg-white">
          <span className="text-xs text-[#98A2B3]">{dirty ? 'Unsaved changes' : ''}</span>
          <div className="flex gap-2">
            <button type="button" onClick={requestClose} className="px-4 py-2.5 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (editing && !dirty)}
              className="px-5 py-2.5 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold hover:brightness-105 transition-all disabled:opacity-60"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Log course'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  )
}

function ConfirmDelete({ course, busy, onCancel, onConfirm }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#101828]/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div>
          <h3 className="font-serif font-semibold text-lg text-[#1B2340]">Delete this entry?</h3>
          <p className="text-sm text-[#667085] mt-1">
            “{course.courseName}” will be removed permanently. This can&apos;t be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8]">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} className="px-4 py-2 rounded-md bg-[#D92D20] text-white text-sm font-medium hover:bg-[#B42318] disabled:opacity-60">
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function NptelCourseLogPage() {
  const user = useSelector((state) => state.auth?.user)
  const myId = user?._id || user?.id

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('')
  const [year, setYear] = useState('')
  const [cert, setCert] = useState('')
  const [mine, setMine] = useState(false)
  const [page, setPage] = useState(1)

  const [drawer, setDrawer] = useState(null) // null | 'new' | course
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      setCourses(await fetchAll())
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load courses.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => setPage(1), [query, platform, year, cert, mine])

  const canManage = (c) => c.faculty?._id === myId || user?.role === 'SUPER_ADMIN'

  const platforms = useMemo(() => [...new Set(courses.map((c) => c.platform).filter(Boolean))].sort(), [courses])
  const years = useMemo(
    () => [...new Set(courses.map(yearOf).filter(Boolean))].sort((a, b) => b - a),
    [courses]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return courses.filter((c) => {
      if (q && !`${c.courseName} ${facultyName(c)} ${c.score || ''}`.toLowerCase().includes(q)) return false
      if (platform && c.platform !== platform) return false
      if (year && String(yearOf(c)) !== year) return false
      if (cert === 'yes' && !c.certificateEarned) return false
      if (cert === 'no' && c.certificateEarned) return false
      if (mine && c.faculty?._id !== myId) return false
      return true
    })
  }, [courses, query, platform, year, cert, mine, myId])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtersActive = Boolean(query || platform || year || cert || mine)

  const thisYear = new Date().getFullYear()
  const stats = {
    total: courses.length,
    certified: courses.filter((c) => c.certificateEarned).length,
    thisYear: courses.filter((c) => yearOf(c) === thisYear).length,
    faculty: new Set(courses.map((c) => c.faculty?._id).filter(Boolean)).size,
  }

  const clearFilters = () => {
    setQuery('')
    setPlatform('')
    setYear('')
    setCert('')
    setMine(false)
  }

  const exportCsv = () => {
    const header = ['Course', 'Faculty', 'Platform', 'Duration', 'Start date', 'Completion date', 'Score', 'Certificate']
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = filtered.map((c) => [
      c.courseName,
      facultyName(c),
      c.platform,
      c.duration,
      iso(c.startDate),
      iso(c.completionDate),
      c.score,
      c.certificateEarned ? 'Yes' : 'No',
    ])
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'nptel-courses.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const confirmDelete = async () => {
    setDeleteBusy(true)
    try {
      await nptelService.delete(deleting._id)
      toast.success('Entry deleted')
      setDeleting(null)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete this entry.')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif font-semibold text-2xl text-[#1B2340]">NPTEL / Faculty Development Courses</h2>
          <p className="text-sm text-[#667085] mt-1">Courses undertaken by faculty for professional development.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#E4E7EC] bg-white text-sm text-[#475467] hover:bg-[#F5F6F8] disabled:opacity-50"
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => setDrawer('new')}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold px-4 py-2 rounded-md hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all"
          >
            <Plus size={15} /> Log a course
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={BookOpen} label="Courses logged" value={stats.total} />
        <StatTile icon={Award} label="Certificates earned" value={stats.certified} />
        <StatTile icon={Calendar} label={`Completed in ${thisYear}`} value={stats.thisYear} />
        <StatTile icon={Users} label="Faculty involved" value={stats.faculty} />
      </div>

      {error && <p className="text-sm text-[#B42318]">{error}</p>}

      {/* Filters */}
      <div className="bg-white border border-[#E4E7EC] rounded-xl p-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search course, faculty or score…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
          />
        </div>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]">
          <option value="">All platforms</option>
          {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className="px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]">
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={cert} onChange={(e) => setCert(e.target.value)} className="px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]">
          <option value="">Any certificate</option>
          <option value="yes">Certified</option>
          <option value="no">No certificate</option>
        </select>
        <button
          type="button"
          aria-pressed={mine}
          onClick={() => setMine((v) => !v)}
          className={`px-3 py-2 rounded-md border text-sm transition-colors ${
            mine ? 'border-[#1B2340] bg-[#1B2340] text-white' : 'border-[#E4E7EC] text-[#475467] hover:bg-[#F5F6F8]'
          }`}
        >
          My courses
        </button>
        {filtersActive && (
          <button type="button" onClick={clearFilters} className="text-xs font-medium text-[#C9962C] hover:underline px-1">
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="px-5 py-4 border-t border-[#F2F4F7] first:border-t-0 space-y-2">
              <div className="h-3.5 w-1/3 bg-[#F2F4F7] rounded animate-pulse" />
              <div className="h-2.5 w-1/5 bg-[#F2F4F7] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white border border-dashed border-[#D0D5DD] rounded-xl p-12 text-center space-y-3">
          <GraduationCap size={32} className="mx-auto text-[#98A2B3]" />
          <p className="text-sm text-[#667085]">No courses logged yet.</p>
          <button type="button" onClick={() => setDrawer('new')} className="text-sm font-medium text-[#C9962C] hover:underline">
            Log the first course
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-[#D0D5DD] rounded-xl p-10 text-center space-y-2">
          <p className="text-sm text-[#667085]">No courses match these filters.</p>
          <button type="button" onClick={clearFilters} className="text-sm font-medium text-[#C9962C] hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] text-left text-[11px] uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Faculty</th>
                  <th className="px-4 py-3 font-semibold">Platform</th>
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Certificate</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => (
                  <tr key={c._id} className="border-t border-[#F2F4F7] hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-[#1B2340]">{c.courseName}</p>
                      {c.duration && <p className="text-xs text-[#98A2B3] mt-0.5">{c.duration}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-[#1B2340] text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                          {initialsOf(c)}
                        </span>
                        <span className="text-[#475467]">{facultyName(c)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-full bg-[#EFF4FF] text-[#1B2340] text-xs font-medium">{c.platform || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 text-[#667085] whitespace-nowrap">
                      {c.startDate && <span>{formatDate(c.startDate)} – </span>}
                      {c.completionDate ? formatDate(c.completionDate) : c.startDate ? 'Ongoing' : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-[#667085]">{c.score || '—'}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.certificateEarned ? 'bg-[#E7F3ED] text-[#2E7D5B]' : 'bg-[#F2F4F7] text-[#667085]'}`}>
                          {c.certificateEarned ? 'Certified' : 'No'}
                        </span>
                        {c.certificateUrl && (
                          <a
                            href={c.certificateUrl.startsWith('http') ? c.certificateUrl : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}${c.certificateUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C9962C] hover:underline"
                            title="View / Download certificate"
                          >
                            <Award size={12} /> View cert
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {canManage(c) ? (
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => setDrawer(c)} aria-label="Edit course" title="Edit" className="p-1.5 rounded text-[#667085] hover:text-[#1B2340] hover:bg-[#F2F4F7]">
                            <Pencil size={15} />
                          </button>
                          <button type="button" onClick={() => setDeleting(c)} aria-label="Delete course" title="Delete" className="p-1.5 rounded text-[#667085] hover:text-[#B42318] hover:bg-[#FEF3F2]">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-right text-xs text-[#D0D5DD]">—</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-[#F2F4F7] text-xs text-[#667085]">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </div>
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {drawer && (
        <CourseDrawer
          course={drawer === 'new' ? null : drawer}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null)
            load()
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete course={deleting} busy={deleteBusy} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}