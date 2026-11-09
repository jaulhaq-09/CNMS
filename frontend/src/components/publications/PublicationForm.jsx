import React, { useState, useEffect, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { ArrowUp, ArrowDown, X, Plus, Quote } from 'lucide-react'
import usePermissions from '../../hooks/usePermissions'
import { PERMISSIONS } from '../../config/permissions'
import publicationService from '../../services/publicationService'
import { PUBLICATION_TYPES, buildCitation, normalizeDoi, doiLooksValid } from '../../utils/citation'
import { DraftRestoredBanner } from '../../hooks/useFormDraft'

const NOT_INDEXED = 'Not Indexed'
const INDEXING_OPTIONS = ['Scopus', 'SCI', 'WoS', 'UGC-CARE', 'Other', NOT_INDEXED]
const THIS_YEAR = new Date().getFullYear()

const TYPE_TEXT = {
  JOURNAL: { title: 'Title of the paper', venue: 'Journal name', venuePlaceholder: 'e.g. Journal of Biomedical Photonics & Engineering' },
  CONFERENCE: { title: 'Title of the paper', venue: 'Conference name', venuePlaceholder: 'e.g. 2026 International Conference on Emerging Smart Computing and Informatics (ESCI)' },
  BOOK_CHAPTER: { title: 'Chapter title', venue: 'Book title', venuePlaceholder: 'Title of the book this chapter appears in' },
  BOOK: { title: 'Book title', venue: null },
}

const EMPTY_FORM = {
  title: '',
  publicationType: 'JOURNAL',
  venueName: '',
  doi: '',
  publicationYear: String(THIS_YEAR),
  volume: '',
  issue: '',
  pages: '',
  publisher: '',
  editors: '',
  edition: '',
  isbn: '',
  conferenceStartDate: '',
  conferenceEndDate: '',
  conferenceVenue: '',
  cluster: '',
  section: '',
}

const inputClass = (hasError) =>
  `w-full px-3 py-2 rounded-md border text-sm text-[#1B2340] placeholder:text-[#98A2B3] bg-white focus:outline-none transition-colors ${
    hasError ? 'border-[#F04438] focus:border-[#F04438]' : 'border-[#E4E7EC] focus:border-[#C9962C]'
  }`

const optional = (value) => {
  const text = String(value ?? '').trim()
  return text || undefined
}

function validate(form, authors, clusterRequired) {
  const e = {}
  const type = form.publicationType
  const cleanAuthors = authors.map((a) => a.trim()).filter(Boolean)

  if (!form.title.trim()) e.title = 'Required.'
  else if (form.title.trim().length > 500) e.title = 'Keep it under 500 characters.'

  if (cleanAuthors.length === 0) {
    e.authors = 'Add at least one author.'
  } else {
    const seen = new Set()
    for (const name of cleanAuthors) {
      const key = name.toLowerCase()
      if (seen.has(key)) {
        e.authors = `“${name}” is listed twice.`
        break
      }
      seen.add(key)
    }
  }

  if (type !== 'BOOK' && !form.venueName.trim()) e.venueName = 'Required.'
  if ((type === 'BOOK' || type === 'BOOK_CHAPTER') && !form.publisher.trim()) e.publisher = 'Required.'

  if (type === 'CONFERENCE') {
    if (!form.conferenceStartDate) e.conferenceStartDate = 'Required.'
    if (
      form.conferenceStartDate &&
      form.conferenceEndDate &&
      form.conferenceEndDate < form.conferenceStartDate
    ) {
      e.conferenceEndDate = 'Ends before it starts.'
    }
  } else {
    const year = form.publicationYear.trim()
    if (!/^\d{4}$/.test(year)) e.publicationYear = 'Enter a 4-digit year.'
    else if (Number(year) < 1900 || Number(year) > THIS_YEAR + 1)
      e.publicationYear = `Between 1900 and ${THIS_YEAR + 1}.`
  }

  if (form.doi.trim() && !doiLooksValid(form.doi)) {
    e.doi = 'Use a DOI like 10.1109/ESCI68015.2026.1234 or its https://doi.org/ link.'
  }

  if (form.isbn.trim()) {
    const digits = form.isbn.replace(/[\s-]/g, '')
    if (!/^(\d{9}[\dXx]|\d{13})$/.test(digits)) e.isbn = 'ISBN must be 10 or 13 digits.'
  }

  if (clusterRequired && !form.cluster) e.cluster = 'Select a cluster.'

  return e
}

function Field({ label, htmlFor, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[#1B2340] mb-1.5">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-[#B42318] mt-1">{error}</p>
      ) : (
        hint && <p className="text-xs text-[#98A2B3] mt-1">{hint}</p>
      )}
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <section className="border border-[#E4E7EC] rounded-lg p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[#1B2340]">{title}</h3>
        {subtitle && <p className="text-xs text-[#667085] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

export default function PublicationForm({ onPosted, onCollect, initial, onCancel }) {
  const { can, scope } = usePermissions()

  const [form, setForm] = useState(
    initial?.form || {
      ...EMPTY_FORM,
      // One cluster: chosen automatically. Several: the person picks.
      cluster: scope.clusters?.length === 1 ? scope.clusters[0] : '',
    }
  )
  const [authors, setAuthors] = useState(initial?.authors || [''])
  const [indexing, setIndexing] = useState(initial?.indexing || [])
  const [touched, setTouched] = useState({})
  const [attempted, setAttempted] = useState(false)
  const [verified, setVerified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [draftRestored, setDraftRestored] = useState(false)

  const draftKey = 'cnms_draft_publication'

  // Restore draft if editing new entry
  useEffect(() => {
    if (initial) return
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.form && parsed.form.title) {
          setForm(parsed.form)
          if (Array.isArray(parsed.authors) && parsed.authors.length > 0) setAuthors(parsed.authors)
          if (Array.isArray(parsed.indexing)) setIndexing(parsed.indexing)
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
    if (!form.title && !form.venueName && authors.every((a) => !a)) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ form, authors, indexing }))
      } catch (e) {
        // ignore
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [form, authors, indexing, initial])

  const clearPublicationDraft = () => {
    try {
      localStorage.removeItem(draftKey)
      setDraftRestored(false)
      resetForm()
    } catch (e) {
      // ignore
    }
  }

  const authorRefs = useRef([])
  const pendingFocus = useRef(null)

  useEffect(() => {
    if (pendingFocus.current !== null) {
      authorRefs.current[pendingFocus.current]?.focus()
      pendingFocus.current = null
    }
  }, [authors])

  const type = form.publicationType
  const text = TYPE_TEXT[type]
  const cleanAuthors = useMemo(() => authors.map((a) => a.trim()).filter(Boolean), [authors])
  const clusterCount = scope.clusters?.length || 0
  const errors = useMemo(() => validate(form, authors, clusterCount > 1), [form, authors, clusterCount])
  const errorCount = Object.keys(errors).length

  const citation = useMemo(
    () =>
      buildCitation({
        ...form,
        authors: cleanAuthors,
        doi: normalizeDoi(form.doi),
      }),
    [form, cleanAuthors]
  )

  if (!can(PERMISSIONS.EVENTS_CREATE)) {
    return (
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 text-sm text-[#667085]">
        You don&apos;t have permission to submit publications.
      </div>
    )
  }

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  const blur = (field) => () => setTouched((prev) => ({ ...prev, [field]: true }))
  const showError = (field) => (attempted || touched[field] ? errors[field] : '')

  // ---- Authors ----
  const updateAuthor = (index) => (e) =>
    setAuthors((prev) => prev.map((a, i) => (i === index ? e.target.value : a)))

  const addAuthor = () => {
    pendingFocus.current = authors.length
    setAuthors([...authors, ''])
  }

  const removeAuthor = (index) => setAuthors((prev) => prev.filter((_, i) => i !== index))

  const moveAuthor = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= authors.length) return
    setAuthors((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const onAuthorKeyDown = (index) => (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (authors[index].trim()) {
      if (index === authors.length - 1) addAuthor()
      else authorRefs.current[index + 1]?.focus()
    }
  }

  // ---- Indexing ("Not Indexed" excludes everything else) ----
  const toggleIndexing = (option) => {
    setIndexing((prev) => {
      if (option === NOT_INDEXED) return prev.includes(NOT_INDEXED) ? [] : [NOT_INDEXED]
      const withoutNone = prev.filter((i) => i !== NOT_INDEXED)
      return withoutNone.includes(option)
        ? withoutNone.filter((i) => i !== option)
        : [...withoutNone, option]
    })
  }

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, publicationType: form.publicationType, cluster: form.cluster })
    setAuthors([''])
    setIndexing([])
    setTouched({})
    setAttempted(false)
    setVerified(false)
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
      setError('Please confirm you have verified all publication details before submitting.')
      return
    }

    const isConference = type === 'CONFERENCE'
    const isJournal = type === 'JOURNAL'
    const isChapter = type === 'BOOK_CHAPTER'
    const isBook = type === 'BOOK'

    const payload = {
      title: form.title.trim(),
      authors: cleanAuthors,
      publicationType: type,
      venueName: isBook ? undefined : form.venueName.trim(),
      doi: normalizeDoi(form.doi) || undefined,
      indexing: isBook ? [] : indexing,
      publicationYear: isConference
        ? Number(form.conferenceStartDate.slice(0, 4))
        : Number(form.publicationYear),
      volume: isJournal ? optional(form.volume) : undefined,
      issue: isJournal ? optional(form.issue) : undefined,
      pages: !isBook ? optional(form.pages) : undefined,
      publisher: isBook || isChapter ? optional(form.publisher) : undefined,
      editors: isChapter ? optional(form.editors) : undefined,
      edition: isBook ? optional(form.edition) : undefined,
      isbn: isBook || isChapter ? optional(form.isbn) : undefined,
      conferenceStartDate: isConference ? form.conferenceStartDate || undefined : undefined,
      conferenceEndDate: isConference ? form.conferenceEndDate || undefined : undefined,
      conferenceVenue: isConference ? optional(form.conferenceVenue) : undefined,
      department: scope.departmentId,
      cluster: form.cluster || undefined,
      section: form.section || undefined,
    }

    if (onCollect) {
      onCollect({
        payload,
        raw: { form, authors, indexing },
        title: payload.title,
        detail: citation,
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await publicationService.create(payload)
      const publication = response.data
      await publicationService.submit(publication._id)

      clearPublicationDraft()
      resetForm()
      toast.success('Publication submitted for review')
      onPosted?.(publication)
    } catch (err) {
      const details = err.response?.data?.errors
      const message =
        Array.isArray(details) && details.length > 0
          ? details.map((d) => d.message).join(' ')
          : err.response?.data?.message || 'Could not submit the publication.'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const showClusterSection = (scope.clusters?.length || 0) > 0 || (scope.sections?.length || 0) > 0

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white border border-[#E4E7EC] rounded-lg p-6 space-y-5 animate-[fadeInUp_0.2s_ease-out]"
    >
      {draftRestored && (
        <DraftRestoredBanner
          onClear={clearPublicationDraft}
          message="Your in-progress publication details were restored from your previous session."
        />
      )}
      {/* 1. Type */}
      <Section title="What are you adding?" subtitle="The form below changes to match.">
        <div role="radiogroup" aria-label="Publication type" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PUBLICATION_TYPES.map((t) => {
            const selected = type === t.value
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setForm((prev) => ({ ...prev, publicationType: t.value }))}
                className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  selected
                    ? 'border-[#C9962C] bg-[#C9962C]/10'
                    : 'border-[#E4E7EC] hover:bg-[#F5F6F8]'
                }`}
              >
                <span className="block text-sm font-medium text-[#1B2340]">{t.label}</span>
                <span className="block text-[11px] text-[#667085] mt-0.5">{t.hint}</span>
              </button>
            )
          })}
        </div>
      </Section>

      {/* 2. Title + authors */}
      <Section title="Title and authors" subtitle="List authors in the order they appear on the paper.">
        <div className="space-y-4">
          <Field label={text.title} htmlFor="pub-title" error={showError('title')}>
            <input
              id="pub-title"
              type="text"
              value={form.title}
              onChange={update('title')}
              onBlur={blur('title')}
              className={inputClass(showError('title'))}
            />
          </Field>

          <div>
            <p className="block text-sm font-medium text-[#1B2340] mb-1.5">Author(s)</p>
            <div className="space-y-2">
              {authors.map((author, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-6 text-xs text-[#98A2B3] text-right shrink-0">{index + 1}.</span>
                  <input
                    ref={(el) => (authorRefs.current[index] = el)}
                    type="text"
                    aria-label={`Author ${index + 1}`}
                    placeholder="e.g. M. S. Swetha"
                    value={author}
                    onChange={updateAuthor(index)}
                    onKeyDown={onAuthorKeyDown(index)}
                    onBlur={blur('authors')}
                    className={inputClass(false)}
                  />
                  <div className="flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => moveAuthor(index, -1)}
                      disabled={index === 0}
                      aria-label="Move author up"
                      className="p-1.5 rounded text-[#98A2B3] hover:text-[#1B2340] hover:bg-[#F5F6F8] disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveAuthor(index, 1)}
                      disabled={index === authors.length - 1}
                      aria-label="Move author down"
                      className="p-1.5 rounded text-[#98A2B3] hover:text-[#1B2340] hover:bg-[#F5F6F8] disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowDown size={14} />
                    </button>
                    {authors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAuthor(index)}
                        aria-label="Remove author"
                        className="p-1.5 rounded text-[#98A2B3] hover:text-[#B42318] hover:bg-[#FEF3F2]"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {showError('authors') && <p className="text-xs text-[#B42318] mt-1.5">{showError('authors')}</p>}
            <button
              type="button"
              onClick={addAuthor}
              className="mt-2 inline-flex items-center gap-1 text-xs text-[#C9962C] font-medium hover:underline"
            >
              <Plus size={13} /> Add author
            </button>
          </div>
        </div>
      </Section>

      {/* 3. Publication details */}
      <Section title="Publication details">
        <div className="space-y-4">
          {text.venue && (
            <Field label={text.venue} htmlFor="pub-venue" error={showError('venueName')}>
              <input
                id="pub-venue"
                type="text"
                value={form.venueName}
                placeholder={text.venuePlaceholder}
                onChange={update('venueName')}
                onBlur={blur('venueName')}
                className={inputClass(showError('venueName'))}
              />
            </Field>
          )}

          {type === 'JOURNAL' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Year" htmlFor="pub-year" error={showError('publicationYear')}>
                <input
                  id="pub-year"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.publicationYear}
                  onChange={update('publicationYear')}
                  onBlur={blur('publicationYear')}
                  className={inputClass(showError('publicationYear'))}
                />
              </Field>
              <Field label="Volume" htmlFor="pub-volume">
                <input id="pub-volume" value={form.volume} onChange={update('volume')} placeholder="12" className={inputClass(false)} />
              </Field>
              <Field label="Issue" htmlFor="pub-issue">
                <input id="pub-issue" value={form.issue} onChange={update('issue')} placeholder="1" className={inputClass(false)} />
              </Field>
              <Field label="Pages" htmlFor="pub-pages">
                <input id="pub-pages" value={form.pages} onChange={update('pages')} placeholder="105–118" className={inputClass(false)} />
              </Field>
            </div>
          )}

          {type === 'CONFERENCE' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Start date" htmlFor="pub-conf-start" error={showError('conferenceStartDate')}>
                  <input
                    id="pub-conf-start"
                    type="date"
                    value={form.conferenceStartDate}
                    onChange={update('conferenceStartDate')}
                    onBlur={blur('conferenceStartDate')}
                    className={inputClass(showError('conferenceStartDate'))}
                  />
                </Field>
                <Field label="End date (optional)" htmlFor="pub-conf-end" error={showError('conferenceEndDate')}>
                  <input
                    id="pub-conf-end"
                    type="date"
                    value={form.conferenceEndDate}
                    onChange={update('conferenceEndDate')}
                    onBlur={blur('conferenceEndDate')}
                    className={inputClass(showError('conferenceEndDate'))}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="City, country" htmlFor="pub-conf-venue">
                  <input
                    id="pub-conf-venue"
                    value={form.conferenceVenue}
                    onChange={update('conferenceVenue')}
                    placeholder="e.g. Pune, India"
                    className={inputClass(false)}
                  />
                </Field>
                <Field label="Pages (optional)" htmlFor="pub-pages">
                  <input id="pub-pages" value={form.pages} onChange={update('pages')} placeholder="105–118" className={inputClass(false)} />
                </Field>
              </div>
            </>
          )}

          {type === 'BOOK_CHAPTER' && (
            <>
              <Field label="Editor(s) (optional)" htmlFor="pub-editors" hint="Separate several names with commas.">
                <input id="pub-editors" value={form.editors} onChange={update('editors')} className={inputClass(false)} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Publisher" htmlFor="pub-publisher" error={showError('publisher')}>
                  <input
                    id="pub-publisher"
                    value={form.publisher}
                    onChange={update('publisher')}
                    onBlur={blur('publisher')}
                    placeholder="e.g. Springer"
                    className={inputClass(showError('publisher'))}
                  />
                </Field>
                <Field label="Year" htmlFor="pub-year" error={showError('publicationYear')}>
                  <input
                    id="pub-year"
                    inputMode="numeric"
                    maxLength={4}
                    value={form.publicationYear}
                    onChange={update('publicationYear')}
                    onBlur={blur('publicationYear')}
                    className={inputClass(showError('publicationYear'))}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Pages (optional)" htmlFor="pub-pages">
                  <input id="pub-pages" value={form.pages} onChange={update('pages')} placeholder="105–118" className={inputClass(false)} />
                </Field>
                <Field label="ISBN (optional)" htmlFor="pub-isbn" error={showError('isbn')}>
                  <input id="pub-isbn" value={form.isbn} onChange={update('isbn')} onBlur={blur('isbn')} className={inputClass(showError('isbn'))} />
                </Field>
              </div>
            </>
          )}

          {type === 'BOOK' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Publisher" htmlFor="pub-publisher" error={showError('publisher')}>
                  <input
                    id="pub-publisher"
                    value={form.publisher}
                    onChange={update('publisher')}
                    onBlur={blur('publisher')}
                    placeholder="e.g. Wiley"
                    className={inputClass(showError('publisher'))}
                  />
                </Field>
                <Field label="Edition (optional)" htmlFor="pub-edition">
                  <input id="pub-edition" value={form.edition} onChange={update('edition')} placeholder="2nd" className={inputClass(false)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Year" htmlFor="pub-year" error={showError('publicationYear')}>
                  <input
                    id="pub-year"
                    inputMode="numeric"
                    maxLength={4}
                    value={form.publicationYear}
                    onChange={update('publicationYear')}
                    onBlur={blur('publicationYear')}
                    className={inputClass(showError('publicationYear'))}
                  />
                </Field>
                <Field label="ISBN (optional)" htmlFor="pub-isbn" error={showError('isbn')}>
                  <input id="pub-isbn" value={form.isbn} onChange={update('isbn')} onBlur={blur('isbn')} className={inputClass(showError('isbn'))} />
                </Field>
              </div>
            </>
          )}

          <Field
            label="DOI (optional)"
            htmlFor="pub-doi"
            error={showError('doi')}
            hint="Paste the DOI or its link. It is saved as a clickable link."
          >
            <input
              id="pub-doi"
              type="text"
              value={form.doi}
              onChange={update('doi')}
              onBlur={blur('doi')}
              placeholder="10.1109/… or https://doi.org/…"
              className={inputClass(showError('doi'))}
            />
          </Field>
        </div>
      </Section>

      {/* 4. Indexing */}
      {type !== 'BOOK' && (
        <Section title="Indexing" subtitle="Where is this publication indexed?">
          <div className="flex flex-wrap gap-2">
            {INDEXING_OPTIONS.map((option) => {
              const selected = indexing.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleIndexing(option)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    selected
                      ? 'border-[#1B2340] bg-[#1B2340] text-white'
                      : 'border-[#E4E7EC] text-[#334155] hover:bg-[#F5F6F8]'
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </Section>
      )}

      {/* 5. Cluster / section */}
      {showClusterSection && (
        <Section title="Cluster and section">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Cluster" htmlFor="pub-cluster" error={showError('cluster')}>
              <select
                id="pub-cluster"
                value={form.cluster}
                onChange={update('cluster')}
                onBlur={blur('cluster')}
                className={`${inputClass(showError('cluster'))} bg-white`}
              >
                <option value="">{clusterCount > 1 ? 'Select a cluster' : '— None —'}</option>
                {(scope.clusters || []).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Section" htmlFor="pub-section">
              <select
                id="pub-section"
                value={form.section}
                onChange={update('section')}
                className={`${inputClass(false)} bg-white`}
              >
                <option value="">— None —</option>
                {(scope.sections || []).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
        </Section>
      )}

      {/* 6. Live citation preview */}
      <div className="rounded-lg border border-[#C9962C]/30 bg-[#FFFBF2] p-5">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-[#B07C1F] font-semibold mb-2">
          <Quote size={12} /> How it will appear in the report
        </p>
        {citation ? (
          <p className="text-sm text-[#1B2340] leading-relaxed">{citation}</p>
        ) : (
          <p className="text-sm text-[#98A2B3]">
            Your citation appears here as you add the title and authors.
          </p>
        )}
      </div>

      {!onCollect && (
        <div className="bg-[#F5F6F8] rounded-md p-3">
          <label className="flex items-start gap-2 text-xs text-[#334155]">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="mt-0.5"
            />
            I confirm I have verified all author names, bibliographic details, and dates before submitting.
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
          {onCollect
            ? initial
              ? 'Save changes'
              : 'Add publication'
            : submitting
            ? 'Submitting...'
            : 'Submit publication'}
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