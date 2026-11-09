import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS } from '../config/permissions'
import { REPORT_WIZARD_STEPS as STEPS } from '../config/reportWizardSteps'
import { formatDate } from '../utils/date'
import eventService from '../services/eventService'
import publicationService from '../services/publicationService'
import patentService from '../services/patentService'
import PublicationForm from '../components/publications/PublicationForm'
import PatentEntryForm from '../components/patents/PatentEntryForm'
import SimpleStepForm, { EMPTY_SIMPLE, simpleProblem, todayISO } from '../components/report/SimpleStepForm'
import { compressAll } from '../utils/compressImage'

const uid = () => Math.random().toString(36).slice(2, 10)
const draftKey = (id) => `cnms_mpr_draft_${id || 'anon'}`

function loadDraft(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Photos (File objects) can't be stored; keep only how many there were.
function serialize(entries) {
  const out = {}
  Object.entries(entries).forEach(([cat, e]) => {
    out[cat] = {
      skipped: !!e.skipped,
      items: (e.items || []).map((it) =>
        Array.isArray(it.files)
          ? { ...it, files: [], lostPhotos: Math.max(it.files.length, it.lostPhotos || 0) }
          : it
      ),
    }
  })
  return out
}

const itemKey = (step, item) => `${step.category}:${item.uid}`

// Older drafts stored NIL as a single item; it is now a section-level "nothing to report".
function normalize(entries) {
  const out = {}
  Object.entries(entries || {}).forEach(([cat, e]) => {
    out[cat] = (e.items || []).some((it) => it.nil) ? { skipped: true, items: [] } : e
  })
  return out
}

function stepState(step, entry) {
  if (entry?.skipped) return 'done'
  const items = entry?.items || []
  if (step.type === 'simple') {
    return items.length > 0 && items.every((it) => !simpleProblem(it)) ? 'done' : 'todo'
  }
  return items.length ? 'done' : 'todo'
}

function errorMessage(err) {
  const details = err?.response?.data?.errors
  if (Array.isArray(details) && details.length > 0) return details.map((d) => d.message).join(' ')
  return err?.response?.data?.message || 'Could not submit this section.'
}

function simpleSummary(item) {
  if (!item) return ''
  const bits = []
  if (item.date) bits.push(formatDate(item.date))
  if (item.description?.trim()) bits.push(item.description.trim())
  return bits.join(' · ')
}

const gold =
  'px-5 py-2.5 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none'
const outline =
  'px-4 py-2.5 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8] disabled:opacity-50'

const GROUPS = [
  { label: 'Academic & Institutional', cats: ['MOU', 'STUDENT_ACHIEVEMENT', 'PROFESSIONAL_ACTIVITY', 'WORKSHOP_ORGANIZED', 'INDUSTRIAL_VISIT'] },
  { label: 'Faculty', cats: ['FACULTY_AWARD', 'RESOURCE_PERSON', 'FDP_ORGANIZED'] },
  { label: 'Research', cats: ['COLLABORATIVE_RESEARCH', 'PUBLICATION', 'PATENT'] },
  { label: 'Student Life & Outreach', cats: ['BICEP_ACTIVITY', 'ALUMNI_INTERACTION', 'CLUB_ACTIVITY', 'NSS', 'NCC', 'SPORTS', 'PLACEMENT_ACTIVITY', 'HEC_EVENT'] },
]
const groupOf = (cat) => GROUPS.find((g) => g.cats.includes(cat))?.label || ''

const HINTS = {
  MOU: 'organisation signed with, date, purpose and expected outcomes.',
  STUDENT_ACHIEVEMENT: 'student name(s), USN, achievement, event and level (state / national / international).',
  PROFESSIONAL_ACTIVITY: 'the activity, professional body or society, and the faculty involved.',
  WORKSHOP_ORGANIZED: 'title, resource person, venue, number of participants and outcome.',
  INDUSTRIAL_VISIT: 'company visited, batch / semester, number of students and key learnings.',
  FACULTY_AWARD: 'faculty name, award, awarding body and what it recognises.',
  RESOURCE_PERSON: 'faculty name, topic delivered, institution / event and date.',
  FDP_ORGANIZED: 'FDP title, duration, resource persons and number of participants.',
  COLLABORATIVE_RESEARCH: 'partner institution / industry, topic, faculty and students involved.',
  BICEP_ACTIVITY: 'the activity, startup / team involved, and the outcome.',
  ALUMNI_INTERACTION: 'alumnus name and batch, topic, and number of students who attended.',
  CLUB_ACTIVITY: 'club name, activity, participants and outcome.',
  NSS: 'programme, venue, volunteers and community impact.',
  NCC: 'camp / parade / activity, cadets involved and outcome.',
  SPORTS: 'event, level, team / player names and result.',
  PLACEMENT_ACTIVITY: 'company, drive type, students shortlisted / placed.',
  HEC_EVENT: 'event title, date, participants and outcome.',
}

const chip = 'px-2.5 py-1 rounded-full bg-white/10 text-xs text-white/85'
const actionBar =
  'sticky bottom-3 z-10 flex items-center justify-between gap-3 bg-white/90 backdrop-blur border border-[#E4E7EC] rounded-xl px-4 py-3 shadow-sm'

export default function MonthlyReportPage() {
  const { can, scope } = usePermissions()
  const navigate = useNavigate()
  const user = useSelector((s) => s.auth?.user)
  const key = draftKey(user?._id || user?.id)

  const [initialDraft] = useState(() => loadDraft(key))
  const [entries, setEntries] = useState(() => normalize(initialDraft?.entries))
  const [stepIndex, setStepIndex] = useState(Math.min(initialDraft?.stepIndex || 0, STEPS.length - 1))
  const [reviewing, setReviewing] = useState(!!initialDraft?.reviewing)
  const [cluster, setCluster] = useState(initialDraft?.cluster || '')
  const [section, setSection] = useState(initialDraft?.section || '')
  const [scopeOpen, setScopeOpen] = useState(false)
  const [formState, setFormState] = useState(null) // null | 'add' | { edit: index }
  const [showErrors, setShowErrors] = useState(false)
  const [results, setResults] = useState(initialDraft?.results || {})
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [finished, setFinished] = useState(false)
  const [showRestored, setShowRestored] = useState(
    !!initialDraft && Object.keys(initialDraft.entries || {}).length > 0
  )
  const progress = useRef(initialDraft?.progress || {})

  useEffect(() => {
    if (scope.clusters.length === 1) setCluster(scope.clusters[0])
    if (scope.sections.length === 1) setSection(scope.sections[0])
  }, [scope.clusters, scope.sections])

  // Opening a plain section gives you one blank entry to type into straight away.
  useEffect(() => {
    const st = STEPS[stepIndex]
    if (reviewing || !st || st.type !== 'simple') return
    setEntries((prev) => {
      const e = prev[st.category]
      if (e?.skipped || (e?.items || []).length) return prev
      return {
        ...prev,
        [st.category]: { skipped: false, items: [{ uid: uid(), ...EMPTY_SIMPLE, date: todayISO() }] },
      }
    })
  }, [stepIndex, reviewing, entries])

  // Autosave the draft so a refresh or closed tab never loses the work.
  useEffect(() => {
    if (finished) return
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          entries: serialize(entries),
          stepIndex,
          reviewing,
          cluster,
          section,
          results,
          progress: progress.current,
        })
      )
    } catch {
      /* storage full or blocked — the wizard still works, just without autosave */
    }
  }, [entries, stepIndex, reviewing, cluster, section, results, finished, key])

  if (!can(PERMISSIONS.EVENTS_CREATE)) {
    return (
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 text-sm text-[#667085]">
        You don&apos;t have permission to submit reports.
      </div>
    )
  }

  const needsScope = (scope.clusters.length > 1 && !cluster) || (scope.sections.length > 1 && !section)

  const stepStates = STEPS.map((s) => stepState(s, entries[s.category]))
  const doneCount = stepStates.filter((s) => s === 'done').length
  const allDone = doneCount === STEPS.length
  const isSent = (step, item) => results[itemKey(step, item)]?.state === 'sent'

  // ---------- navigation ----------
  const goTo = (i) => {
    setReviewing(false)
    setFormState(null)
    setShowErrors(false)
    setStepIndex(i)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const goReview = () => {
    setFormState(null)
    setShowErrors(false)
    setReviewing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const goNext = () => (stepIndex >= STEPS.length - 1 ? goReview() : goTo(stepIndex + 1))
  const goPrev = () => (reviewing ? goTo(STEPS.length - 1) : goTo(Math.max(0, stepIndex - 1)))

  // ---------- entry updates ----------
  const itemsOf = (cat) => entries[cat]?.items || []
  const addItem = (cat, data) =>
    setEntries((prev) => ({ ...prev, [cat]: { skipped: false, items: [...itemsOf(cat), { uid: uid(), ...data }] } }))
  const replaceItem = (cat, index, data) =>
    setEntries((prev) => ({
      ...prev,
      [cat]: { skipped: false, items: itemsOf(cat).map((it, i) => (i === index ? { ...it, ...data } : it)) },
    }))
  const removeItem = (cat, index) =>
    setEntries((prev) => ({ ...prev, [cat]: { skipped: false, items: itemsOf(cat).filter((_, i) => i !== index) } }))
  const setSkipped = (cat, skipped) =>
    setEntries((prev) => ({ ...prev, [cat]: { skipped, items: [] } }))

  const discardDraft = () => {
    if (!window.confirm('Discard this draft and start over? Everything you entered will be cleared.')) return
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    progress.current = {}
    setEntries({})
    setResults({})
    setConfirmed(false)
    setShowRestored(false)
    goTo(0)
  }

  // ---------- final submit ----------
  const sendItem = async (step, item, k, nth = 1, total = 1) => {
    const prog = (progress.current[k] = progress.current[k] || {})

    if (step.type === 'simple') {
      const date = item.nil ? todayISO() : item.date
      if (!prog.id) {
        const res = await eventService.create({
          eventName: total > 1 ? `${step.label} (${nth}) - ${date}` : `${step.label} - ${date}`,
          description: item.nil ? 'NIL' : item.description.trim(),
          eventType: 'Other',
          eventDate: date,
          department: scope.departmentId,
          cluster,
          section,
          activityCategory: step.category,
        })
        prog.id = res.data.id || res.data._id
      }
      if (!item.nil && item.files.length > 0 && !prog.photos) {
        prog.photos = true
        try {
          const small = await compressAll(item.files)
          await eventService.uploadPhotos(prog.id, small)
        } catch (err) {
          const why = err?.response?.data?.message || err?.message || ''
          toast.error(`${step.label}: saved, but the photos could not be uploaded. ${why}`)
        }
      }
      await eventService.submit(prog.id)
      return
    }

    const service = step.type === 'publication' ? publicationService : patentService
    if (!prog.id) {
      const res = await service.create(item.payload)
      prog.id = res.data._id
    }
    await service.submit(prog.id)
  }

  const submitAll = async () => {
    setSubmitting(true)
    const next = { ...results }

    for (const step of STEPS) {
      const entry = entries[step.category]
      // A plain section marked "nothing to report" is still sent, as a NIL entry.
      const items =
        step.type === 'simple' && entry?.skipped
          ? [{ uid: 'nil', nil: true, date: '', description: '', files: [] }]
          : entry?.items || []
      for (const [idx, item] of items.entries()) {
        const k = itemKey(step, item)
        if (next[k]?.state === 'sent') continue
        try {
          await sendItem(step, item, k, idx + 1, items.length)
          next[k] = { state: 'sent' }
        } catch (err) {
          next[k] = { state: 'error', message: errorMessage(err) }
        }
        setResults({ ...next })
      }
    }

    setSubmitting(false)
    const failed = Object.values(next).filter((r) => r.state === 'error').length
    if (failed === 0) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
      setFinished(true)
      window.scrollTo({ top: 0 })
    } else {
      toast.error(`${failed} section${failed > 1 ? 's' : ''} could not be submitted. Fix them and retry.`)
    }
  }

  // ---------- screens ----------
  if (needsScope || scopeOpen) {
    return (
      <div className="space-y-6">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-[#667085] hover:text-[#C9962C] transition-colors">
          ← Back to Dashboard
        </Link>
        <div>
          <h2 className="font-serif font-semibold text-2xl text-[#1B2340]">Before you start</h2>
          <p className="text-sm text-[#667085] mt-1">Which cluster and section is this report for?</p>
        </div>
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {scope.clusters.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-[#1B2340] mb-1.5">Cluster</label>
                <select
                  value={cluster}
                  onChange={(e) => setCluster(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
                >
                  <option value="" disabled>Select a cluster</option>
                  {scope.clusters.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            {scope.sections.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-[#1B2340] mb-1.5">Section</label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
                >
                  <option value="" disabled>Select a section</option>
                  {scope.sections.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button type="button" disabled={needsScope} onClick={() => setScopeOpen(false)} className={gold}>
            Continue
          </button>
        </div>
      </div>
    )
  }

  if (finished) {
    const sentCount = Object.values(results).filter((r) => r.state === 'sent').length
    return (
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-10 text-center space-y-3">
        <CheckCircle2 size={40} className="mx-auto text-[#2E7D5B]" />
        <h2 className="font-serif font-semibold text-2xl text-[#1B2340]">Report submitted</h2>
        <p className="text-sm text-[#667085] max-w-md mx-auto">
          {sentCount} item{sentCount === 1 ? '' : 's'} sent to your coordinator for review.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={() => navigate('/dashboard')} className={gold}>Back to Dashboard</button>
          <button
            onClick={() => {
              progress.current = {}
              setEntries({})
              setResults({})
              setConfirmed(false)
              setFinished(false)
              goTo(0)
            }}
            className={outline}
          >
            Start another report
          </button>
        </div>
      </div>
    )
  }

  const step = STEPS[stepIndex]
  const entry = entries[step.category]
  const items = entry?.items || []
  const failedCount = Object.values(results).filter((r) => r.state === 'error').length

  const allItems = STEPS.flatMap((s) => (entries[s.category]?.items || []).map((it) => ({ s, it })))
  const nilCount = STEPS.filter((s) => entries[s.category]?.skipped).length
  const reportedCount = allItems.length
  const photoTotal = allItems.reduce((n, { it }) => n + (it.files?.length || 0), 0)

  // ---------- review ----------
  const reviewView = (
    <div className="space-y-5">
      <div>
        <h3 className="font-serif font-semibold text-xl text-[#1B2340]">Review and submit</h3>
        <p className="text-sm text-[#667085] mt-1">
          Check every section. Use <span className="font-medium">Edit</span> to fix anything — nothing is
          sent until you press Submit report.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Sections done', value: `${doneCount}/${STEPS.length}` },
          { label: 'Entries to submit', value: reportedCount },
          { label: 'NIL sections', value: nilCount },
          { label: 'Photos attached', value: photoTotal },
        ].map((t) => (
          <div key={t.label} className="bg-white border border-[#E4E7EC] rounded-lg px-4 py-3">
            <p className="text-2xl font-serif font-semibold text-[#1B2340]">{t.value}</p>
            <p className="text-[11px] uppercase tracking-wide text-[#667085] mt-0.5">{t.label}</p>
          </div>
        ))}
      </div>

      <ul className="bg-white border border-[#E4E7EC] rounded-lg divide-y divide-[#E4E7EC]">
        {STEPS.map((s, i) => {
          const e = entries[s.category]
          const st = stepStates[i]
          const list = e?.items || []
          const nilResult = results[`${s.category}:nil`]
          const allSent = e?.skipped
            ? s.type === 'simple' && nilResult?.state === 'sent'
            : list.length > 0 && list.every((it) => isSent(s, it))
          return (
            <li key={s.category} className="p-4 flex items-start gap-3">
              <span
                className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${st === 'done' ? 'bg-[#E7F3ED] text-[#2E7D5B]' : 'bg-[#FBF3E7] text-[#B07C1F]'
                  }`}
              >
                {st === 'done' ? <Check size={12} /> : <AlertCircle size={12} />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#1B2340]">{s.label}</p>

                {st === 'todo' && <p className="text-xs text-[#B07C1F] mt-0.5">Not filled in yet</p>}

                {s.type === 'simple' &&
                  list.map((it, n) => {
                    const r = results[itemKey(s, it)]
                    return (
                      <div key={it.uid} className="mt-1.5">
                        <p className="text-xs text-[#667085] line-clamp-2">
                          {list.length > 1 ? `${n + 1}. ` : ''}
                          {simpleSummary(it)}
                          {it.files?.length > 0 && ` · ${it.files.length} photo(s)`}
                        </p>
                        {r?.state === 'sent' && <p className="text-xs text-[#2E7D5B]">Submitted</p>}
                        {r?.state === 'error' && <p className="text-xs text-[#B42318]">{r.message}</p>}
                      </div>
                    )
                  })}

                {e?.skipped && <p className="text-xs text-[#667085] mt-0.5">Nothing to report</p>}
                {e?.skipped && nilResult?.state === 'sent' && <p className="text-xs text-[#2E7D5B]">Submitted</p>}
                {e?.skipped && nilResult?.state === 'error' && (
                  <p className="text-xs text-[#B42318]">{nilResult.message}</p>
                )}
                {s.type !== 'simple' &&
                  list.map((it) => {
                    const r = results[itemKey(s, it)]
                    return (
                      <div key={it.uid} className="mt-1.5">
                        <p className="text-xs text-[#1B2340]">{it.title}</p>
                        <p className="text-xs text-[#667085] line-clamp-2">{it.detail}</p>
                        {r?.state === 'sent' && <p className="text-xs text-[#2E7D5B]">Submitted</p>}
                        {r?.state === 'error' && <p className="text-xs text-[#B42318]">{r.message}</p>}
                      </div>
                    )
                  })}
              </div>

              {!allSent && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => goTo(i)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#C9962C] hover:underline shrink-0 disabled:opacity-50"
                >
                  <Pencil size={12} /> {st === 'todo' ? 'Fill in' : 'Edit'}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <div className="bg-[#F5F6F8] rounded-md p-3">
        <label className="flex items-start gap-2 text-xs text-[#334155]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          I confirm I have verified all names, dates, photographs, and details in this report before
          submitting.
        </label>
      </div>

      {!allDone && (
        <p className="text-xs text-[#B07C1F]">
          {STEPS.length - doneCount} section{STEPS.length - doneCount > 1 ? 's' : ''} still need an answer
          (or NIL).
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="button" disabled={submitting} onClick={goPrev} className={outline}>
          ← Previous
        </button>
        <button type="button" disabled={!allDone || !confirmed || submitting} onClick={submitAll} className={gold}>
          {submitting ? (
            <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Submitting…</span>
          ) : failedCount > 0 ? (
            'Retry failed sections'
          ) : (
            'Submit report'
          )}
        </button>
      </div>
    </div>
  )

  // ---------- one step ----------
  const stepView = (() => {
    if (step.type === 'simple') {
      const firstIsBlank =
        items.length === 1 && !items[0].description?.trim() && !(items[0].files?.length > 0)
      return (
        <div className="space-y-5">
          {entry?.skipped ? (
            <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 flex items-center justify-between gap-3">
              <p className="text-sm text-[#667085]">Marked as nothing to report (NIL) for this section.</p>
              <button
                type="button"
                onClick={() => setSkipped(step.category, false)}
                className="text-xs font-medium text-[#C9962C] hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              {items.map((it, index) => {
                const sent = isSent(step, it)
                return (
                  <div key={it.uid} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
                        Entry {index + 1}
                      </p>
                      {sent ? (
                        <span className="text-xs text-[#2E7D5B]">Submitted</span>
                      ) : (
                        items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(step.category, index)}
                            className="inline-flex items-center gap-1 text-xs text-[#98A2B3] hover:text-[#B42318]"
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        )
                      )}
                    </div>
                    {sent ? (
                      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 text-sm text-[#2E7D5B]">
                        This entry was already submitted.
                      </div>
                    ) : (
                      <SimpleStepForm
                        idPrefix={`entry-${it.uid}`}
                        value={it}
                        onChange={(patch) => replaceItem(step.category, index, patch)}
                        showErrors={showErrors}
                        hint={HINTS[step.category]}
                      />
                    )}
                  </div>
                )
              })}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => addItem(step.category, { ...EMPTY_SIMPLE, date: todayISO() })}
                  className={gold}
                >
                  <span className="inline-flex items-center gap-1">
                    <Plus size={14} /> Add another entry
                  </span>
                </button>
                {firstIsBlank && (
                  <button type="button" onClick={() => setSkipped(step.category, true)} className={outline}>
                    Nothing to report (NIL)
                  </button>
                )}
              </div>
            </>
          )}

          <div className={actionBar}>
            <button type="button" onClick={goPrev} disabled={stepIndex === 0} className={outline}>
              <span className="inline-flex items-center gap-1"><ChevronLeft size={14} /> Previous</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (stepStates[stepIndex] !== 'done') {
                  setShowErrors(true)
                  return
                }
                goNext()
              }}
              className={gold}
            >
              <span className="inline-flex items-center gap-1">
                {entry?.skipped ? 'Mark NIL & continue' : 'Save & continue'} <ChevronRight size={14} />
              </span>
            </button>
          </div>
        </div>
      )
    }

    // publication / patent: any number of entries, or "nothing to report"
    const noun = step.type === 'publication' ? 'publication' : 'patent'
    const FormComp = step.type === 'publication' ? PublicationForm : PatentEntryForm
    const editing = formState && typeof formState === 'object'

    if (formState) {
      return (
        <div className="space-y-4">
          <p className="text-sm font-medium text-[#1B2340]">
            {editing ? `Edit ${noun}` : `Add a ${noun}`}
          </p>
          <FormComp
            key={editing ? `edit-${formState.edit}` : 'add'}
            initial={editing ? items[formState.edit]?.raw : undefined}
            onCollect={(data) => {
              if (editing) replaceItem(step.category, formState.edit, data)
              else addItem(step.category, data)
              setFormState(null)
            }}
            onCancel={() => setFormState(null)}
          />
        </div>
      )
    }

    return (
      <div className="space-y-5">
        {items.length > 0 && (
          <ul className="bg-white border border-[#E4E7EC] rounded-lg divide-y divide-[#E4E7EC]">
            {items.map((it, index) => {
              const sent = isSent(step, it)
              return (
                <li key={it.uid} className="p-4 flex items-start gap-3">
                  <span className="w-5 text-xs text-[#98A2B3] pt-0.5">{index + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1B2340]">{it.title}</p>
                    <p className="text-xs text-[#667085] mt-0.5 line-clamp-3">{it.detail}</p>
                  </div>
                  {sent ? (
                    <span className="text-xs text-[#2E7D5B] shrink-0">Submitted</span>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setFormState({ edit: index })}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#C9962C] hover:underline px-1.5 py-1"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(step.category, index)}
                        aria-label={`Remove ${noun}`}
                        className="p-1.5 rounded text-[#98A2B3] hover:text-[#B42318] hover:bg-[#FEF3F2]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {entry?.skipped && (
          <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 flex items-center justify-between gap-3">
            <p className="text-sm text-[#667085]">Marked as nothing to report for this section.</p>
            <button
              type="button"
              onClick={() => setSkipped(step.category, false)}
              className="text-xs font-medium text-[#C9962C] hover:underline"
            >
              Change
            </button>
          </div>
        )}

        {!entry?.skipped && (
          <div className="bg-white border border-dashed border-[#D0D5DD] rounded-lg p-6 text-center space-y-3">
            <p className="text-sm text-[#667085]">
              {items.length === 0
                ? `Add a ${noun}, or mark this section as having nothing to report.`
                : `Have another ${noun} to add?`}
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <button type="button" onClick={() => setFormState('add')} className={gold}>
                <span className="inline-flex items-center gap-1"><Plus size={14} /> Add {items.length ? 'another' : `a ${noun}`}</span>
              </button>
              {items.length === 0 && (
                <button type="button" onClick={() => setSkipped(step.category, true)} className={outline}>
                  Nothing to report
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="button" onClick={goPrev} disabled={stepIndex === 0} className={outline}>
            <span className="inline-flex items-center gap-1"><ChevronLeft size={14} /> Previous</span>
          </button>
          <button type="button" onClick={goNext} disabled={stepStates[stepIndex] !== 'done'} className={gold}>
            <span className="inline-flex items-center gap-1">Continue <ChevronRight size={14} /></span>
          </button>
        </div>
      </div>
    )
  })()

  const month = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const deptName = typeof user?.department === 'object' ? user.department?.name : ''
  const multiScope = scope.clusters.length > 1 || scope.sections.length > 1
  const ringLen = 2 * Math.PI * 26

  return (
    <div className="space-y-6">
      {/* Header band */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1B2340] via-[#1F1938] to-[#241C42] text-white px-6 py-5">
        <div className="absolute -top-16 -left-10 w-56 h-56 bg-[#C0392B]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#F0A8A0] font-semibold">
              Monthly Progress Report · {month}
            </p>
            <h2 className="font-serif font-semibold text-2xl mt-1">Report this month&apos;s activities</h2>
            <p className="text-sm text-white/65 mt-1 max-w-xl">
              Answer each section or mark it NIL. Review everything on the last screen — nothing is sent
              until you submit.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {deptName && <span className={chip}>{deptName}</span>}
              {cluster && <span className={chip}>Cluster: {cluster}</span>}
              {section && <span className={chip}>Section: {section}</span>}
              {multiScope && (
                <button
                  type="button"
                  onClick={() => setScopeOpen(true)}
                  className="text-xs text-[#E0B563] font-medium hover:underline"
                >
                  Change
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="relative w-16 h-16">
              <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="#E0B563"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={ringLen}
                  strokeDashoffset={ringLen * (1 - doneCount / STEPS.length)}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
                {doneCount}/{STEPS.length}
              </span>
            </div>
            <div className="text-xs text-white/65 leading-relaxed">
              <p className="text-white font-medium text-sm">{doneCount} sections done</p>
              <p className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" /> Draft saved automatically
              </p>
            </div>
          </div>
        </div>
      </div>

      {showRestored && (
        <div className="flex items-center justify-between gap-3 bg-[#EFF4FF] text-[#1B2340] text-sm rounded-lg px-4 py-3">
          <span>Your saved draft was restored. Photos aren&apos;t kept on refresh — re-attach them if needed.</span>
          <button type="button" onClick={() => setShowRestored(false)} className="text-xs font-medium hover:underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[272px_1fr] gap-6 items-start">
        {/* Section list */}
        <aside className="lg:sticky lg:top-4">
          <select
            value={reviewing ? 'review' : stepIndex}
            onChange={(e) => (e.target.value === 'review' ? goReview() : goTo(Number(e.target.value)))}
            disabled={submitting}
            className="lg:hidden w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white"
          >
            {STEPS.map((s, i) => (
              <option key={s.category} value={i}>
                {stepStates[i] === 'done' ? '✓ ' : ''}{i + 1}. {s.label}
              </option>
            ))}
            <option value="review">Review and submit</option>
          </select>

          <nav
            aria-label="Report sections"
            className="hidden lg:block bg-white border border-[#E4E7EC] rounded-xl p-2 max-h-[calc(100vh-2rem)] overflow-y-auto"
          >
            {GROUPS.map((g) => {
              const idxs = g.cats.map((c) => STEPS.findIndex((s) => s.category === c)).filter((i) => i >= 0)
              const groupDone = idxs.filter((i) => stepStates[i] === 'done').length
              return (
                <div key={g.label} className="mb-1.5">
                  <p className="flex items-center justify-between px-2.5 pt-2.5 pb-1 text-[10px] uppercase tracking-[0.15em] font-semibold text-[#98A2B3]">
                    <span>{g.label}</span>
                    <span>{groupDone}/{idxs.length}</span>
                  </p>
                  <ol className="space-y-0.5">
                    {idxs.map((i) => {
                      const s = STEPS[i]
                      const active = !reviewing && i === stepIndex
                      const done = stepStates[i] === 'done'
                      return (
                        <li key={s.category}>
                          <button
                            type="button"
                            title={s.label}
                            disabled={submitting}
                            onClick={() => goTo(i)}
                            className={`w-full flex items-center gap-2.5 pl-2 pr-2.5 py-2 rounded-md text-left text-[13px] leading-snug border-l-2 transition-colors ${active
                                ? 'border-[#C9962C] bg-[#C9962C]/10 text-[#1B2340] font-medium'
                                : 'border-transparent text-[#475467] hover:bg-[#F5F6F8]'
                              }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${done ? 'bg-[#2E7D5B] text-white' : active ? 'bg-[#C9962C] text-white' : 'bg-[#F2F4F7] text-[#667085]'
                                }`}
                            >
                              {done ? <Check size={11} /> : i + 1}
                            </span>
                            <span className="line-clamp-2">{s.label}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )
            })}

            <div className="pt-1.5 mt-1 border-t border-[#E4E7EC]">
              <button
                type="button"
                disabled={submitting}
                onClick={goReview}
                className={`w-full px-2.5 py-2.5 rounded-md text-left text-[13px] font-semibold transition-colors ${reviewing ? 'bg-[#1B2340] text-white' : 'text-[#1B2340] bg-[#F5F6F8] hover:bg-[#EDEFF3]'
                  }`}
              >
                Review and submit →
              </button>
            </div>
          </nav>

          <button
            type="button"
            disabled={submitting}
            onClick={discardDraft}
            className="mt-3 text-xs text-[#98A2B3] hover:text-[#B42318] disabled:opacity-50"
          >
            Discard draft
          </button>
        </aside>

        {/* Current step */}
        <main className="min-w-0 space-y-5">
          {!reviewing && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#98A2B3] font-semibold">
                {groupOf(step.category)} · Section {stepIndex + 1} of {STEPS.length}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <h3 className="font-serif font-semibold text-2xl text-[#1B2340]">{step.label}</h3>
                {stepStates[stepIndex] === 'done' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E7F3ED] text-[#2E7D5B] text-xs font-medium">
                    <Check size={11} /> Complete
                  </span>
                )}
              </div>
            </div>
          )}
          {reviewing ? reviewView : stepView}
        </main>
      </div>
    </div>
  )
}