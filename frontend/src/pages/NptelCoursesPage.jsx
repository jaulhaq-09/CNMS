import React, { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Award } from 'lucide-react'
import nptelService from '../services/nptelService'
import Pagination from '../components/common/Pagination'
import { formatDate } from '../utils/date'

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

const EMPTY_FORM = {
  courseName: '',
  platform: 'NPTEL',
  customPlatform: '',
  duration: '',
  startDate: '',
  completionDate: '',
  certificateEarned: false,
  score: '',
}

export default function NptelCoursesPage() {
  const user = useSelector((state) => state.auth?.user)

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ totalPages: 1 })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [certificateFile, setCertificateFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmingId, setConfirmingId] = useState(null)

  const load = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true)
      setError('')
      const response = await nptelService.getAll({}, pageNum, 10)
      setCourses(response.data)
      setPagination({ totalPages: response.pagination?.totalPages || 1 })
      setPage(pageNum)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load courses.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(1)
  }, [load])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

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
    try {
      setSaving(true)
      const effectivePlatform =
        form.platform === 'Other'
          ? (form.customPlatform?.trim() || 'Other')
          : (form.platform?.trim() || 'NPTEL')

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
        await nptelService.create(formData)
      } else {
        await nptelService.create({
          ...form,
          platform: effectivePlatform,
        })
      }

      toast.success('Course logged')
      setForm(EMPTY_FORM)
      setCertificateFile(null)
      setShowForm(false)
      load(1)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not log this course.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await nptelService.delete(id)
      toast.success('Entry deleted')
      setConfirmingId(null)
      load(page)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete this entry.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif font-semibold text-2xl text-[#1B2340]">
            NPTEL / Faculty Development Courses
          </h2>
          <p className="text-sm text-[#667085] mt-1">
            Log courses you've undertaken for professional development.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold px-4 py-2 rounded-md hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all"
        >
          + Log a course
        </button>
      </div>

      {error && <p className="text-sm text-[#B42318]">{error}</p>}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#E4E7EC] rounded-lg p-6 space-y-4 animate-[fadeInUp_0.2s_ease-out]"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="courseName" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                Course name
              </label>
              <input
                id="courseName"
                name="courseName"
                required
                value={form.courseName}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
            </div>
            <div>
              <label htmlFor="platform" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                Platform
              </label>
              <select
                id="platform"
                name="platform"
                value={form.platform}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C] bg-white"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            {form.platform === 'Other' && (
              <div>
                <label htmlFor="customPlatform" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                  Platform Name
                </label>
                <input
                  id="customPlatform"
                  name="customPlatform"
                  value={form.customPlatform || ''}
                  onChange={handleChange}
                  placeholder="Specify platform name"
                  className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
                />
              </div>
            )}
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                Duration
              </label>
              <input
                id="duration"
                name="duration"
                placeholder="e.g. 8 weeks"
                value={form.duration}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
            </div>
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                Start date
              </label>
              <input
                id="startDate"
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
            </div>
            <div>
              <label htmlFor="completionDate" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                Completion date
              </label>
              <input
                id="completionDate"
                type="date"
                name="completionDate"
                value={form.completionDate}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
            </div>
            <div>
              <label htmlFor="score" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                Score / Grade (optional)
              </label>
              <input
                id="score"
                name="score"
                placeholder="e.g. 82% or Elite + Gold"
                value={form.score}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <input
                type="checkbox"
                id="certificateEarned"
                name="certificateEarned"
                checked={form.certificateEarned}
                onChange={handleChange}
              />
              <label htmlFor="certificateEarned" className="text-sm text-[#334155]">
                Certificate earned
              </label>
            </div>

            {form.certificateEarned && (
              <div className="col-span-2 p-3 bg-gray-50 border border-gray-200 rounded-md space-y-2">
                <label className="block text-xs font-semibold text-[#1B2340]">
                  Attach Certificate (PDF, PNG, JPG)
                </label>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handleCertificateChange}
                  className="block w-full text-xs text-[#667085] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#1B2340] file:text-white hover:file:bg-[#2C3860]"
                />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save entry'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="bg-white border border-[#E4E7EC] rounded-lg overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-4 border-t border-gray-100 first:border-t-0">
              <div className="h-3.5 w-1/3 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E4E7EC] rounded-lg p-10 text-center">
          <p className="text-sm text-[#667085]">No courses logged yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E4E7EC] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Faculty</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Certificate</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c._id} className="border-t border-gray-100 hover:bg-[#F5F6F8] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1B2340]">{c.courseName}</td>
                  <td className="px-4 py-3 text-[#667085]">
                    {c.faculty ? `${c.faculty.firstName} ${c.faculty.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{c.platform}</td>
                  <td className="px-4 py-3 text-[#667085]">
                    {c.completionDate ? formatDate(c.completionDate) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.certificateEarned
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {c.certificateEarned ? 'Yes' : 'No'}
                      </span>
                      {c.certificateUrl && (
                        <a
                          href={c.certificateUrl.startsWith('http') ? c.certificateUrl : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}${c.certificateUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#C9962C] font-medium hover:underline"
                        >
                          <Award size={12} /> View
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(c.faculty?._id === user?._id || user?.role === 'SUPER_ADMIN') && (
                      confirmingId === c._id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-500">Sure?</span>
                          <button
                            onClick={() => handleDelete(c._id)}
                            className="text-red-600 font-semibold text-xs hover:underline"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmingId(null)}
                            className="text-gray-500 text-xs hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingId(c._id)}
                          className="text-red-600 font-medium hover:underline"
                        >
                          Delete
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination currentPage={page} totalPages={pagination.totalPages} onPageChange={(p) => load(p)} />
    </div>
  )
}
            <div>
              <label htmlFor="completionDate" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                Completion date
              </label>
              <input
                id="completionDate"
                type="date"
                name="completionDate"
                value={form.completionDate}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
            </div>
            <div>
              <label htmlFor="score" className="block text-sm font-medium text-[#1B2340] mb-1.5">
                Score / Grade (optional)
              </label>
              <input
                id="score"
                name="score"
                placeholder="e.g. 82% or Elite + Gold"
                value={form.score}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
              />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <input
                type="checkbox"
                id="certificateEarned"
                name="certificateEarned"
                checked={form.certificateEarned}
                onChange={handleChange}
              />
              <label htmlFor="certificateEarned" className="text-sm text-[#334155]">
                Certificate earned
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save entry'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-md border border-[#E4E7EC] text-sm text-[#667085] hover:bg-[#F5F6F8]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="bg-white border border-[#E4E7EC] rounded-lg overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-4 border-t border-gray-100 first:border-t-0">
              <div className="h-3.5 w-1/3 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E4E7EC] rounded-lg p-10 text-center">
          <p className="text-sm text-[#667085]">No courses logged yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E4E7EC] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Faculty</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Certificate</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c._id} className="border-t border-gray-100 hover:bg-[#F5F6F8] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1B2340]">{c.courseName}</td>
                  <td className="px-4 py-3 text-[#667085]">
                    {c.faculty ? `${c.faculty.firstName} ${c.faculty.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{c.platform}</td>
                  <td className="px-4 py-3 text-[#667085]">
                    {c.completionDate ? formatDate(c.completionDate) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.certificateEarned
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.certificateEarned ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(c.faculty?._id === user?._id || user?.role === 'SUPER_ADMIN') && (
                      confirmingId === c._id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-500">Sure?</span>
                          <button
                            onClick={() => handleDelete(c._id)}
                            className="text-red-600 font-semibold text-xs hover:underline"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmingId(null)}
                            className="text-gray-500 text-xs hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingId(c._id)}
                          className="text-red-600 font-medium hover:underline"
                        >
                          Delete
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination currentPage={page} totalPages={pagination.totalPages} onPageChange={(p) => load(p)} />
    </div>
  )
}