import toast from 'react-hot-toast'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Building2, Mail, Phone, Pencil, PowerOff, Layers, Trash2 } from 'lucide-react'
import departmentService from '../../services/departmentService'
import clusterService from '../../services/clusterService'
import sectionService from '../../services/sectionService'
import ClusterSectionManager from './ClusterSectionManager'

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
  email: '',
  phone: '',
  clusters: [{ name: '', sections: [''] }],
}

export default function DepartmentManagementPage() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmingId, setConfirmingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [structureOpenId, setStructureOpenId] = useState(null)
  const [managementTab, setManagementTab] = useState('details')
  const [codeEdited, setCodeEdited] = useState(false)

  useEffect(() => {
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await departmentService.getAll()
      setDepartments(response.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  const openCreateForm = () => {
    setCodeEdited(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEditForm = (dept) => {
    setEditingId(dept._id)
    setForm({
      name: dept.name || '',
      code: dept.code || '',
      description: dept.description || '',
      email: dept.email || '',
      phone: dept.phone || '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setCodeEdited(false)
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  // "Computer Science and Engineering" -> "CSE"
  const suggestCode = (name) =>
    name
      .split(/\s+/)
      .filter((w) => w && !['and', 'of', 'the', '&'].includes(w.toLowerCase()))
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 10)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: name === 'code' ? value.toUpperCase() : value }
      // Fill the code in for you until you type your own.
      if (name === 'name' && !editingId && !codeEdited) next.code = suggestCode(value)
      return next
    })
    if (name === 'code') setCodeEdited(true)
  }

  const mapCluster = (ci, fn) =>
    setForm((prev) => ({ ...prev, clusters: prev.clusters.map((c, i) => (i === ci ? fn(c) : c)) }))

  const updateClusterName = (ci) => (e) => mapCluster(ci, (c) => ({ ...c, name: e.target.value }))
  const addClusterRow = () =>
    setForm((prev) => ({ ...prev, clusters: [...prev.clusters, { name: '', sections: [''] }] }))
  const removeClusterRow = (ci) =>
    setForm((prev) => ({ ...prev, clusters: prev.clusters.filter((_, i) => i !== ci) }))

  const updateSectionName = (ci, si) => (e) =>
    mapCluster(ci, (c) => ({
      ...c,
      sections: c.sections.map((x, i) => (i === si ? e.target.value : x)),
    }))
  const addSectionRow = (ci) => mapCluster(ci, (c) => ({ ...c, sections: [...c.sections, ''] }))
  const removeSectionRow = (ci, si) =>
    mapCluster(ci, (c) => ({ ...c, sections: c.sections.filter((_, i) => i !== si) }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError('')
      if (editingId) {
        await departmentService.update(editingId, form)
        toast.success('Department updated')
      } else {
        // Check the structure first, so nothing is half-created.
        const rows = form.clusters
          .map((c) => ({
            name: c.name.trim(),
            sections: c.sections
              .flatMap((x) => x.split(','))
              .map((x) => x.trim())
              .filter(Boolean),
          }))
          .filter((c) => c.name)
        const clusterNames = rows.map((c) => c.name.toLowerCase())
        if (new Set(clusterNames).size !== clusterNames.length) {
          setError('Two clusters have the same name.')
          return
        }
        for (const row of rows) {
          const names = row.sections.map((x) => x.toLowerCase())
          if (new Set(names).size !== names.length) {
            setError(`The cluster "${row.name}" has two sections with the same name.`)
            return
          }
        }

        const { clusters: _ignored, ...deptFields } = form
        const response = await departmentService.create(deptFields)
        const newDeptId = response.data._id

        const failed = []
        for (const row of rows) {
          try {
            const clusterRes = await clusterService.create({ name: row.name, department: newDeptId })
            for (const sectionName of row.sections) {
              try {
                await sectionService.create({ name: sectionName, cluster: clusterRes.data._id })
              } catch (sectionErr) {
                failed.push(`${row.name} / ${sectionName}`)
              }
            }
          } catch (clusterErr) {
            failed.push(row.name)
          }
        }
        if (failed.length > 0) {
          toast.error(
            `Department created, but these could not be added: ${failed.join(', ')}. Use Manage Structure to add them.`
          )
        }

        toast.success('Department created')
      }
      closeForm()
      loadDepartments()
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to save department'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (dept) => {
    try {
      await departmentService.delete(dept._id)
      toast.success('Department deactivated')
      setConfirmingId(null)
      loadDepartments()
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to deactivate department'
      setError(message)
      toast.error(message)
    }
  }

  const handleDeletePermanent = async () => {
    if (!deleteTarget) return
    try {
      setDeleteBusy(true)
      setDeleteError('')
      await departmentService.deletePermanent(deleteTarget._id)
      toast.success('Department deleted')
      setDeleteTarget(null)
      if (structureOpenId === deleteTarget._id) setStructureOpenId(null)
      loadDepartments()
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete department')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#667085]">Manage college departments and their structure.</p>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center justify-center bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold px-4 py-2.5 rounded-lg hover:brightness-105 hover:shadow-sm transition-all"
        >
          + New Department
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-5 sm:p-6 border border-[#E4E7EC] rounded-xl bg-white shadow-sm space-y-4 animate-[fadeInUp_0.2s_ease-out]"
        >
          <h2 className="text-lg font-semibold text-[#1B2340]">
            {editingId ? 'Edit Department' : 'New Department'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="dept-name" className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                id="dept-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Computer Science and Engineering"
                required
                className="w-full border border-[#D0D5DD] rounded-lg px-3 py-2.5 text-sm text-[#1B2340] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
              />
            </div>
            <div>
              <label htmlFor="dept-code" className="block text-xs font-medium text-gray-600 mb-1">
                Short code <span className="text-gray-400 font-normal">(used in the Excel import)</span>
              </label>
              <input
                id="dept-code"
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="e.g. CSE"
                maxLength={20}
                required
                className="w-full border border-[#D0D5DD] rounded-lg px-3 py-2.5 text-sm text-[#1B2340] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
              />
            </div>
            {editingId && (
              <>
                <div>
                  <label htmlFor="dept-email" className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    id="dept-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full border border-[#D0D5DD] rounded-lg px-3 py-2.5 text-sm text-[#1B2340] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
                  />
                </div>
                <div>
                  <label htmlFor="dept-phone" className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input
                    id="dept-phone"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full border border-[#D0D5DD] rounded-lg px-3 py-2.5 text-sm text-[#1B2340] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="dept-description" className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea
                    id="dept-description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={2}
                    className="w-full border border-[#D0D5DD] rounded-lg px-3 py-2.5 text-sm text-[#1B2340] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
                  />
                </div>
              </>
            )}
            {!editingId && (
              <div className="sm:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-600">
                    Clusters and sections (optional)
                  </label>
                  <button
                    type="button"
                    onClick={addClusterRow}
                    className="text-xs text-[#C9962C] font-medium hover:underline"
                  >
                    + Add cluster
                  </button>
                </div>
                {form.clusters.map((cluster, ci) => (
                  <div key={ci} className="border border-[#E4E7EC] rounded-xl p-3 bg-[#F8F9FB] space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={cluster.name}
                        onChange={updateClusterName(ci)}
                        placeholder="Cluster name, e.g. AI & ML"
                        aria-label={`Cluster ${ci + 1} name`}
                        className="flex-1 border border-[#D0D5DD] rounded-lg px-3 py-2.5 text-sm font-medium text-[#1B2340] bg-white focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
                      />
                      {form.clusters.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeClusterRow(ci)}
                          className="text-red-500 text-sm px-2 hover:text-red-700"
                          title="Remove this cluster"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="pl-4 space-y-2">
                      {cluster.sections.map((section, si) => (
                        <div key={si} className="flex gap-2">
                          <input
                            type="text"
                            value={section}
                            onChange={updateSectionName(ci, si)}
                            placeholder="Section name, e.g. Section A (or several, separated by commas)"
                            aria-label={`Cluster ${ci + 1}, section ${si + 1} name`}
                            className="flex-1 border border-[#D0D5DD] rounded-lg px-3 py-2 text-sm text-[#1B2340] bg-white focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
                          />
                          {cluster.sections.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSectionRow(ci, si)}
                              className="text-red-500 text-sm px-2 hover:text-red-700"
                              title="Remove this section"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addSectionRow(ci)}
                        className="text-xs text-[#C9962C] font-medium hover:underline"
                      >
                        + Add section
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-400">
                  A cluster with no name is skipped. You can rename or add more later with Manage Structure.
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold px-4 py-2 rounded-md hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Department'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="text-sm font-medium px-4 py-2.5 rounded-lg border border-[#D0D5DD] text-[#475467] hover:bg-[#F8F9FB]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white border border-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="bg-white border border-dashed border-[#D0D5DD] rounded-xl py-16 text-center text-[#667085] text-sm">
          No departments yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {departments.map((dept) => (
            <div
              key={dept._id}
              className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden hover:border-[#C9962C]/40 hover:shadow-md transition-all"
            >
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#1B2340]/5 flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-[#1B2340]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1B2340] text-sm">{dept.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{dept.code}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      dept.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {dept.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  {dept.head && (
                    <p className="text-xs text-gray-500">
                      Head: {dept.head.firstName} {dept.head.lastName}
                    </p>
                  )}
                  {dept.email && (
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Mail size={12} /> {dept.email}
                    </p>
                  )}
                  {dept.phone && (
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Phone size={12} /> {dept.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-[#EAECF0] px-5 py-3 flex items-center justify-between bg-[#F8F9FB]">
                {confirmingId === dept._id ? (
                  <div className="flex items-center gap-2 w-full justify-end">
                    <span className="text-xs text-gray-500">Deactivate this department?</span>
                    <button
                      onClick={() => handleDeactivate(dept)}
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
                  <>
                    <button
                      onClick={() => {
                        setStructureOpenId(structureOpenId === dept._id ? null : dept._id)
                        setManagementTab('details')
                      }}
                      aria-expanded={structureOpenId === dept._id}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#1B2340] hover:text-[#9A6B17] transition-colors"
                    >
                      <Layers size={14} />
                      {structureOpenId === dept._id ? 'Close management' : 'Manage'}
                    </button>
                    <div className="flex items-center gap-3">
                      {dept.isActive && (
                        <button
                          onClick={() => setConfirmingId(dept._id)}
                          className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                        >
                          <PowerOff size={13} /> Deactivate
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setDeleteError('')
                          setDeleteTarget(dept)
                        }}
                        className="flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800 transition-colors"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>

              {structureOpenId === dept._id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50/40">
                  <div role="tablist" aria-label={`${dept.name} management sections`} className="flex gap-2 border-b border-[#E4E7EC] pb-3">
                    {[
                      { id: 'details', label: 'Details' },
                      { id: 'structure', label: 'Clusters & sections' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={managementTab === tab.id}
                        onClick={() => setManagementTab(tab.id)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                          managementTab === tab.id
                            ? 'bg-[#1B2340] text-white'
                            : 'text-[#667085] hover:bg-white hover:text-[#1B2340]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {managementTab === 'details' ? (
                    <div className="grid gap-4 pt-4 sm:grid-cols-[1fr_auto] sm:items-start">
                      <dl className="grid gap-3 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="font-semibold uppercase tracking-wide text-[#98A2B3]">Email</dt>
                          <dd className="mt-1 text-[#475467]">{dept.email || 'Not provided'}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold uppercase tracking-wide text-[#98A2B3]">Phone</dt>
                          <dd className="mt-1 text-[#475467]">{dept.phone || 'Not provided'}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="font-semibold uppercase tracking-wide text-[#98A2B3]">Description</dt>
                          <dd className="mt-1 text-[#475467]">{dept.description || 'No description provided.'}</dd>
                        </div>
                      </dl>
                      <button
                        type="button"
                        onClick={() => openEditForm(dept)}
                        className="inline-flex items-center gap-1.5 self-start rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-semibold text-[#1B2340] hover:border-[#C9962C]"
                      >
                        <Pencil size={13} /> Edit details
                      </button>
                    </div>
                  ) : (
                    <div className="pt-4">
                      <ClusterSectionManager departmentId={dept._id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            onClick={() => !deleteBusy && setDeleteTarget(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                  <Trash2 size={18} className="text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-[#1B2340]">Delete department?</h2>
              </div>

              <p className="text-sm text-gray-600">
                <span className="font-semibold text-[#1B2340]">{deleteTarget.name}</span> and all its clusters and
                sections will be permanently removed. This cannot be undone.
              </p>

              {deleteError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {deleteError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteBusy}
                  className="text-sm px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeletePermanent}
                  disabled={deleteBusy}
                  className="text-sm font-medium px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteBusy ? 'Deleting...' : 'Yes, delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}