import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS } from '../config/permissions'
import facultyAchievementService from '../services/facultyAchievementService'
import departmentService from '../services/departmentService'
import { Link } from 'react-router-dom'
import { useFormDraft, DraftRestoredBanner } from '../hooks/useFormDraft'

const CATEGORIES = [
  { value: 'GRANT', label: 'Grant / Seed Money' },
  { value: 'CERTIFICATION', label: 'Certification Completed' },
  { value: 'COMMITTEE_ROLE', label: 'Committee Role / Invitee' },
  { value: 'AWARD', label: 'Award / Recognition' },
  { value: 'OTHER', label: 'Other' },
]

export default function PostFacultyAchievementPage() {
  const { can, scope } = usePermissions()
  const clusters = scope?.clusters || []
  const user = useSelector((state) => state.auth?.user)

  const [departments, setDepartments] = useState([])
  const [departmentsLoading, setDepartmentsLoading] = useState(true)

  const [form, setForm] = useState({
    title: '',
    department: '',
    // One cluster: chosen automatically. Several: the person picks.
    cluster: clusters.length === 1 ? clusters[0] : '',
    category: 'CERTIFICATION',
    description: '',
    awardingBody: '',
    amount: '',
    achievementDate: '',
  })
  const [verified, setVerified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [justPosted, setJustPosted] = useState(null)

  const draftKey = `cnms_draft_achievement_${user?._id || 'anon'}`
  const { draftRestored, clearDraft } = useFormDraft(draftKey, form, setForm)

  useEffect(() => {
    let cancelled = false

    async function loadDepartments() {
      setDepartmentsLoading(true)
      try {
        const response = await departmentService.getAll()
        const list = Array.isArray(response?.data) ? response.data : []
        if (!cancelled) {
          setDepartments(list)
          // Pre-select the user's own department when they have one
          // (typical FACULTY/COORDINATOR case). SUPER_ADMIN accounts
          // often have no department of their own, so this just leaves
          // the field blank for them to pick one explicitly.
          const userDeptId = user?.department?._id || user?.department
          if (userDeptId) {
            setForm((prev) => ({ ...prev, department: userDeptId }))
          }
        }
      } catch (err) {
        if (!cancelled) setDepartments([])
      } finally {
        if (!cancelled) setDepartmentsLoading(false)
      }
    }

    loadDepartments()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!can(PERMISSIONS.EVENTS_CREATE)) {
    return (
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 text-sm text-[#667085]">
        You don&apos;t have permission to submit achievements.
      </div>
    )
  }

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.department) {
      setError('Please select a department.')
      return
    }

    if (clusters.length > 1 && !form.cluster) {
      setError('Please select which cluster this achievement is for.')
      return
    }

    if (!verified) {
      setError('Please confirm you have verified these details before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const response = await facultyAchievementService.create({
        title: form.title,
        department: form.department,
        cluster: form.cluster || undefined,
        category: form.category,
        description: form.description,
        awardingBody: form.awardingBody || undefined,
        amount: form.amount ? Number(form.amount) : undefined,
        achievementDate: form.achievementDate,
      })

      await facultyAchievementService.submit(response.data._id)

      setForm((prev) => ({
        title: '',
        department: prev.department, // keep the department selected for the next entry
        cluster: prev.cluster,
        category: 'CERTIFICATION',
        description: '',
        awardingBody: '',
        amount: '',
        achievementDate: '',
      }))
      setVerified(false)
      clearDraft()
      setJustPosted(response.data)
      toast.success('Achievement submitted for review')
    } catch (err) {
      const message = err?.response?.data?.message || 'Could not submit the achievement.'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/post" className="inline-flex items-center gap-1 text-sm text-[#667085] hover:text-[#C9962C] transition-colors">
        ← Back to Post
      </Link>
      <div>
        <h2 className="font-serif font-semibold text-2xl text-[#1B2340]">
          Submit a faculty achievement
        </h2>
        <p className="text-sm text-[#667085] mt-1">
          Grants, certifications, committee roles, and awards — reviewed by your coordinator
          before inclusion in the newsletter.
        </p>
      </div>

      {justPosted && (
        <div className="bg-[#E7F3ED] border border-[#2E7D5B]/20 text-[#2E7D5B] text-sm rounded-lg px-4 py-3 animate-[fadeInUp_0.2s_ease-out]">
          &quot;{justPosted.title}&quot; was submitted and is awaiting review.
        </div>
      )}

      {draftRestored && (
        <DraftRestoredBanner
          onClear={clearDraft}
          message="Your in-progress achievement details were restored from your previous session."
        />
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-[#E4E7EC] rounded-lg p-6 space-y-4 animate-[fadeInUp_0.2s_ease-out]">
        <div>
          <label htmlFor="ach-title" className="block text-sm font-medium text-[#1B2340] mb-1.5">
            Title
          </label>
          <input
            id="ach-title"
            type="text"
            required
            value={form.title}
            onChange={update('title')}
            placeholder="e.g. AICTE QIP PG Certification in Machine Learning"
            className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
          />
        </div>

        <div>
          <label htmlFor="ach-department" className="block text-sm font-medium text-[#1B2340] mb-1.5">
            Department
          </label>
          <select
            id="ach-department"
            required
            value={form.department}
            onChange={update('department')}
            disabled={departmentsLoading}
            className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C] disabled:opacity-60"
          >
            <option value="">{departmentsLoading ? 'Loading departments...' : 'Select a department'}</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        {clusters.length > 1 && (
          <div>
            <label htmlFor="ach-cluster" className="block text-sm font-medium text-[#1B2340] mb-1.5">
              Cluster
            </label>
            <select
              id="ach-cluster"
              required
              value={form.cluster}
              onChange={update('cluster')}
              className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
            >
              <option value="" disabled>Select a cluster</option>
              {clusters.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="ach-category" className="block text-sm font-medium text-[#1B2340] mb-1.5">
            Category
          </label>
          <select
            id="ach-category"
            value={form.category}
            onChange={update('category')}
            className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ach-description" className="block text-sm font-medium text-[#1B2340] mb-1.5">
            Description
          </label>
          <textarea
            id="ach-description"
            required
            rows={3}
            value={form.description}
            onChange={update('description')}
            className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="ach-body" className="block text-sm font-medium text-[#1B2340] mb-1.5">
              Awarding body (optional)
            </label>
            <input
              id="ach-body"
              type="text"
              value={form.awardingBody}
              onChange={update('awardingBody')}
              placeholder="e.g. AICTE, IISc"
              className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
            />
          </div>
          <div>
            <label htmlFor="ach-date" className="block text-sm font-medium text-[#1B2340] mb-1.5">
              Date
            </label>
            <input
              id="ach-date"
              type="date"
              required
              value={form.achievementDate}
              onChange={update('achievementDate')}
              className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
            />
          </div>
        </div>

        {form.category === 'GRANT' && (
          <div>
            <label htmlFor="ach-amount" className="block text-sm font-medium text-[#1B2340] mb-1.5">
              Amount (optional)
            </label>
            <input
              id="ach-amount"
              type="number"
              min="0"
              value={form.amount}
              onChange={update('amount')}
              className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
            />
          </div>
        )}

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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !verified}
          className="px-5 py-2.5 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {submitting ? 'Submitting...' : 'Submit achievement'}
        </button>
      </form>
    </div>
  )
}