import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'
import { useSelector } from 'react-redux'
import React, { useState, useEffect } from 'react'
import userService from '../../services/userService'
import departmentService from '../../services/departmentService'
import clusterService from '../../services/clusterService'
import Pagination from '../common/Pagination'
import ImportUsersPanel from './ImportUsersPanel'
import { SelectCell, ChecklistCell, TextCell } from './InlineCells'

const ROLE_OPTIONS = [
  { key: 'ADMIN', dbRole: 'SUPER_ADMIN', label: 'ADMIN' },
  { key: 'COORDINATOR', dbRole: 'COORDINATOR', label: 'COORDINATOR' },
  { key: 'FACULTY', dbRole: 'FACULTY', label: 'FACULTY' },
  { key: 'GUEST', dbRole: 'GUEST', label: 'GUEST' },
]

const getNumberedClusters = (clusters = []) =>
  clusters.filter((cluster) => /^cluster-\d+$/i.test(cluster))

const FILTER_TABS = [
  { key: '', label: 'All', filterRole: '' },
  { key: 'SUPER_ADMIN', label: 'Admin', filterRole: 'SUPER_ADMIN' },
  { key: 'COORDINATOR', label: 'Coordinator', filterRole: 'COORDINATOR' },
  { key: 'FACULTY', label: 'Faculty', filterRole: 'FACULTY' },
]

export default function UserManagementPage() {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [clustersByDepartment, setClustersByDepartment] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const [roleFilter, setRoleFilter] = useState('')

  const [saving, setSaving] = useState(false)

  const currentUser = useSelector((state) => state.auth?.user)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [summary, setSummary] = useState(null)

  const loadSummary = async () => {
    try {
      const res = await userService.getSummary()
      setSummary(res.data)
    } catch (err) {
      // counts are decoration; ignore failures
    }
  }

  useEffect(() => {
    loadSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users])

  const [quickForm, setQuickForm] = useState({
    username: '',
    email: '',
    password: '',
    role: '',
    department: '',
    clusters: [],
  })

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault()
    if (!quickForm.username.trim() || !quickForm.email || !quickForm.password || !quickForm.role || !quickForm.department) {
      toast.error('Username, email, password, role, and department are required')
      return
    }
    if (quickForm.role === 'COORDINATOR' && quickForm.clusters.length === 0) {
      toast.error('Choose at least one cluster for a Coordinator')
      return
    }
    setSaving(true)
    try {
      const rawUsername = quickForm.username.trim() || quickForm.email.split('@')[0]
      const parts = rawUsername.split(/[._ ]+/).filter(Boolean)
      const firstName = parts[0] || 'User'
      const lastName = parts.slice(1).join(' ') || '-'
      const chosenRole = quickForm.role

      await userService.create({
        firstName,
        lastName,
        email: quickForm.email.trim(),
        password: quickForm.password,
        role: chosenRole,
        department: quickForm.department,
        clusters: quickForm.role === 'COORDINATOR' ? quickForm.clusters : [],
        employeeId: quickForm.username.trim() || undefined,
      })
      toast.success('User added successfully')
      setQuickForm({ username: '', email: '', password: '', role: '', department: '', clusters: [] })
      loadUsers(search, 1)
      loadSummary()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add user')
    } finally {
      setSaving(false)
    }
  }

  const saveRoles = async (user, nextRoles) => {
    if (!nextRoles.length) {
      toast.error('A user must have at least one role.')
      throw new Error('A user must have at least one role.')
    }
    const currentRoles = Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : [user.role || 'GUEST']
    const isSelf = user._id === (currentUser?._id || currentUser?.id)
    if (isSelf && currentRoles.includes('SUPER_ADMIN') && !nextRoles.includes('SUPER_ADMIN')) {
      toast.error('You cannot remove your own admin access.')
      throw new Error('You cannot remove your own admin access.')
    }
    try {
      await userService.updateRoles(user._id, nextRoles)
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, roles: nextRoles, role: nextRoles[0] } : u))
      )
      toast.success(`Roles updated for ${user.firstName || user.email}`)
      loadSummary()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update roles')
      throw err
    }
  }

  useEffect(() => {
    loadUsers(search, 1)
    loadDepartments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadUsers = async (searchTerm = '', pageNum = 1) => {
    try {
      setLoading(true)
      setError('')
      const filters = {}
      if (searchTerm) filters.search = searchTerm
      if (roleFilter) filters.role = roleFilter
      const response = await userService.getAll(filters, pageNum)
      setUsers(response.data)
      setPagination({
        total: response.pagination?.total || 0,
        pages: response.pagination?.pages || 1,
      })
      setPage(pageNum)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const response = await departmentService.getAll()
      setDepartments(response.data)
      const entries = await Promise.all(
        response.data.map(async (department) => {
          const clusters = await clusterService.getByDepartment(department._id)
          return [
            department._id,
            getNumberedClusters((clusters.data || []).map((cluster) => cluster.name)),
          ]
        })
      )
      setClustersByDepartment(Object.fromEntries(entries))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load department clusters')
    }
  }

  useEffect(() => {
    loadUsers(search, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    loadUsers(search, 1)
  }

  // ---- Inline editing (click a cell) ----

  // Sends one change to the server together with the person's other
  // access values, and updates just that row on screen. Throws on failure
  // (after showing the message) so the cell can go back to its old value.
  const saveAccess = async (user, patch) => {
    const departmentChanged = 'department' in patch &&
      String(user.department?._id || user.department || '') !== String(patch.department || '')
    const body = {
      role: user.role,
      department: user.department?._id || undefined,
      clusters: departmentChanged ? [] : user.clusters || [],
      sections: departmentChanged ? [] : user.sections || [],
      isActive: user.isActive,
      ...patch,
    }
    try {
      await userService.updateAccess(user._id, body)
      const department =
        'department' in patch
          ? departments.find((d) => d._id === patch.department) || null
          : user.department
      const cleared = 'department' in patch && !patch.department && user.role !== 'SUPER_ADMIN'
      setUsers((prev) =>
        prev.map((u) =>
          u._id === user._id
            ? {
                ...u,
                ...patch,
                department,
                ...(departmentChanged && !('clusters' in patch) ? { clusters: [], sections: [] } : {}),
                ...(cleared ? { role: 'GUEST' } : {}),
              }
            : u
        )
      )
      toast.success('Updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update this user')
      throw err
    }
  }

  const saveDetails = async (user, patch) => {
    try {
      const res = await userService.updateDetails(user._id, patch)
      const updated = res.data || {}
      setUsers((prev) => prev.map((u) => (u._id === user._id ? { ...u, ...updated } : u)))
      toast.success(res.message || 'Updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update this user')
      throw err
    }
  }

  const handleDeleteUser = async () => {
    try {
      setDeleteBusy(true)
      await userService.delete(deleteTarget._id)
      toast.success('User deleted')
      setDeleteTarget(null)
      // If that was the only row on this page, go back one page.
      loadUsers(search, users.length === 1 && page > 1 ? page - 1 : page)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user')
    } finally {
      setDeleteBusy(false)
    }
  }

  const handleDeactivateInstead = async () => {
    try {
      setDeleteBusy(true)
      await userService.updateAccess(deleteTarget._id, {
        role: deleteTarget.role,
        department: deleteTarget.department?._id || undefined,
        clusters: deleteTarget.clusters || [],
        sections: deleteTarget.sections || [],
        isActive: false,
      })
      toast.success('User deactivated')
      setDeleteTarget(null)
      loadUsers(search, page)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to deactivate user')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}

      <section aria-labelledby="add-user-heading" className="bg-white border border-[#E4E7EC] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="add-user-heading" className="text-base font-semibold text-[#1B2340]">Add user</h2>
            <p className="text-sm text-[#667085] mt-0.5">Create an account and assign its role and department.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="text-sm font-semibold px-3.5 py-2 rounded-md border border-[#1B2340]/20 text-[#1B2340] hover:bg-[#1B2340]/5 transition-colors cursor-pointer"
          >
            Import from Excel
          </button>
        </div>

        <form onSubmit={handleQuickAddSubmit} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <label htmlFor="quick-username" className="space-y-1 text-xs font-medium text-[#475467]">
            Username
            <input
              id="quick-username"
              name="username"
              required
              value={quickForm.username}
              onChange={(e) => setQuickForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="Enter username"
              className="w-full border border-[#D0D5DD] rounded-md px-3 py-2 text-sm text-[#1B2340] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
            />
          </label>
          <label htmlFor="quick-email" className="space-y-1 text-xs font-medium text-[#475467]">
            Email
            <input
              id="quick-email"
              name="email"
              type="email"
              required
              value={quickForm.email}
              onChange={(e) => setQuickForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="name@college.edu"
              className="w-full border border-[#D0D5DD] rounded-md px-3 py-2 text-sm text-[#1B2340] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
            />
          </label>
          <label htmlFor="quick-password" className="space-y-1 text-xs font-medium text-[#475467]">
            Password
            <input
              id="quick-password"
              name="password"
              type="password"
              required
              minLength={6}
              value={quickForm.password}
              onChange={(e) => setQuickForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="At least 6 characters"
              className="w-full border border-[#D0D5DD] rounded-md px-3 py-2 text-sm text-[#1B2340] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
            />
          </label>
          <label htmlFor="quick-role" className="space-y-1 text-xs font-medium text-[#475467]">
            Role
            <select
              id="quick-role"
              name="role"
              required
              value={quickForm.role}
              onChange={(e) => setQuickForm((prev) => ({ ...prev, role: e.target.value }))}
              className="w-full border border-[#D0D5DD] rounded-md px-3 py-2 text-sm bg-white text-[#1B2340] font-medium focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
            >
              <option value="" disabled>Select role</option>
              <option value="COORDINATOR">COORDINATOR</option>
              <option value="SUPER_ADMIN">ADMIN</option>
              <option value="FACULTY">FACULTY</option>
              <option value="GUEST">GUEST</option>
            </select>
          </label>
          <label htmlFor="quick-department" className="space-y-1 text-xs font-medium text-[#475467]">
            Department
            <select
              id="quick-department"
              name="department"
              required
              value={quickForm.department}
              onChange={(e) => setQuickForm((prev) => ({
                ...prev,
                department: e.target.value,
                clusters: [],
              }))}
              className="w-full border border-[#D0D5DD] rounded-md px-3 py-2 text-sm bg-white text-[#1B2340] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
            >
              <option value="" disabled>Select department</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>{department.name}</option>
              ))}
            </select>
          </label>
          {quickForm.role === 'COORDINATOR' && (
            <div className="space-y-1 text-xs font-medium text-[#475467]">
              <span>Clusters</span>
              <div className="min-h-10 rounded-md border border-[#D0D5DD] flex items-center">
                <ChecklistCell
                  values={quickForm.clusters}
                  options={clustersByDepartment[quickForm.department] || []}
                  disabled={!quickForm.department || !(clustersByDepartment[quickForm.department] || []).length}
                  title="Choose one or more clusters"
                  onSave={(clusters) => setQuickForm((prev) => ({ ...prev, clusters }))}
                >
                  <span className="text-sm text-[#475467]">
                    {quickForm.clusters.length ? quickForm.clusters.join(', ') : 'Select clusters'}
                  </span>
                </ChecklistCell>
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-[#C9962C] to-[#E0B563] hover:brightness-105 text-[#1B2340] text-sm font-semibold px-6 py-2 rounded-md shadow-sm transition-all disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Adding…' : 'Add user'}
          </button>
        </form>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_TABS.map((tab) => {
            const active = roleFilter === tab.filterRole
            const count = tab.key
              ? (summary?.byRole?.[tab.key] || 0)
              : (summary?.total || pagination.total || 0)
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => setRoleFilter(tab.filterRole)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#1B2340] text-white shadow-sm'
                    : 'bg-white border border-[#E4E7EC] text-[#475467] hover:bg-[#F5F6F8]'
                }`}
              >
                {tab.label} ({count})
              </button>
            )
          })}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="flex-1 min-w-[200px] border border-[#D0D5DD] rounded-md px-3.5 py-2 text-sm text-[#1B2340] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#C9962C]/30 focus:border-[#C9962C]"
          />
          <button
            type="submit"
            className="text-sm font-semibold px-4 py-2 rounded-md border border-[#E4E7EC] text-[#475467] hover:bg-[#F5F6F8] transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      <p className="text-xs text-[#667085]">
        Select a cell to edit it. On narrow screens, swipe the table horizontally; name and actions stay in view.
      </p>

      <div className="bg-white border border-[#E4E7EC] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[1020px] text-sm">
          <thead className="bg-[#F8F9FB] text-left text-[11px] uppercase tracking-wide text-[#667085]">
            <tr>
              <th className="sticky left-0 z-20 min-w-[170px] bg-[#F8F9FB] px-4 py-3 shadow-[4px_0_8px_-6px_rgba(16,24,40,0.25)]">NAME</th>
              <th className="px-4 py-3">USERNAME</th>
              <th className="px-4 py-3">EMAIL</th>
              <th className="px-4 py-3">DEPARTMENT</th>
              <th className="px-4 py-3">CLUSTERS</th>
              <th className="px-4 py-3">ROLES</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="sticky right-0 z-20 min-w-[100px] bg-[#F8F9FB] px-4 py-3 text-right shadow-[-4px_0_8px_-6px_rgba(16,24,40,0.25)]">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="border-t border-[#EAECF0]">
                  <td colSpan={8} className="px-4 py-4">
                    <div className="h-3.5 w-1/3 bg-[#F2F4F7] rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user._id} className="group border-t border-[#EAECF0] hover:bg-[#FAFBFC] transition-colors">
                  <td className="sticky left-0 z-10 min-w-[170px] bg-white px-4 py-3 align-top font-medium text-[#1B2340] shadow-[4px_0_8px_-6px_rgba(16,24,40,0.25)] group-hover:bg-[#FAFBFC]">
                    <TextCell
                      value={`${user.firstName || ''} ${user.lastName || ''}`.trim()}
                      onSave={(name) => saveDetails(user, { name })}
                    >
                      <span className="font-semibold text-gray-900">
                        {user.firstName} {user.lastName}
                      </span>
                    </TextCell>
                    {user.designation && (
                      <div className="text-xs text-gray-500 mt-0.5">{user.designation}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-xs font-mono text-gray-700">
                    <TextCell
                      value={user.employeeId || user.email?.split('@')[0] || ''}
                      onSave={(employeeId) => saveDetails(user, { employeeId })}
                      allowEmpty
                    >
                      {user.employeeId || user.email?.split('@')[0] || '-'}
                    </TextCell>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-gray-700">
                    <TextCell
                      value={user.email}
                      type="email"
                      onSave={(email) => saveDetails(user, { email })}
                    >
                      {user.email}
                    </TextCell>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-gray-700">
                    <SelectCell
                      value={user.department?._id || ''}
                      options={[
                        { value: '', label: 'No department' },
                        ...departments.map((department) => ({
                          value: department._id,
                          label: department.name,
                        })),
                      ]}
                      onSave={(departmentId) => saveAccess(user, {
                        department: departmentId || null,
                      })}
                    >
                      {user.department?.name || 'No department'}
                    </SelectCell>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ChecklistCell
                      values={getNumberedClusters(user.clusters || [])}
                      options={clustersByDepartment[user.department?._id || user.department] || []}
                      disabled={!user.department || !(clustersByDepartment[user.department?._id || user.department] || []).length}
                      title="Choose one or more clusters"
                      includeNone
                      noneLabel="No cluster"
                      onSave={(clusters) => saveAccess(user, { clusters })}
                    >
                      <span className="text-xs font-medium text-gray-700">
                        {getNumberedClusters(user.clusters || []).join(', ') || 'No cluster'}
                      </span>
                    </ChecklistCell>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ChecklistCell
                      values={Array.isArray(user.roles) && user.roles.length > 0
                        ? user.roles
                        : [user.role || 'GUEST']}
                      options={ROLE_OPTIONS.map((opt) => opt.dbRole)}
                      labelFor={(role) => ROLE_OPTIONS.find((opt) => opt.dbRole === role)?.label || role}
                      disabledValues={user._id === (currentUser?._id || currentUser?.id) ? ['SUPER_ADMIN'] : []}
                      onSave={(roles) => saveRoles(user, roles)}
                    >
                      <span className="text-xs font-medium text-gray-700">
                        {(Array.isArray(user.roles) && user.roles.length > 0
                          ? user.roles
                          : [user.role || 'GUEST'])
                          .map((role) => ROLE_OPTIONS.find((opt) => opt.dbRole === role)?.label || role)
                          .join(', ')}
                      </span>
                    </ChecklistCell>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <SelectCell
                      value={user.isActive ? 'active' : 'inactive'}
                      options={[
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                      ]}
                      disabled={user._id === (currentUser?._id || currentUser?.id)}
                      title="You cannot change your own status"
                      onSave={(status) => saveAccess(user, { isActive: status === 'active' })}
                    >
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </SelectCell>
                  </td>
                  <td className="sticky right-0 z-10 min-w-[100px] bg-white px-4 py-3 align-top text-right shadow-[-4px_0_8px_-6px_rgba(16,24,40,0.25)] group-hover:bg-[#FAFBFC]">
                    <div className="flex items-center justify-end gap-3 text-xs font-medium">
                      {user._id !== (currentUser?._id || currentUser?.id) && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(user)}
                          className="rounded-md px-2.5 py-1.5 text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 cursor-pointer"
                          aria-label={`Delete ${user.firstName} ${user.lastName}`}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {deleteTarget &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-[#101828]/40"
              onClick={() => !deleteBusy && setDeleteTarget(null)}
            />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div>
                <h3 className="font-serif font-semibold text-lg text-[#1B2340]">
                  Delete {deleteTarget.firstName} {deleteTarget.lastName}?
                </h3>
                <p className="text-sm text-gray-500 mt-1.5">
                  This permanently removes the account and its login. Events, publications and other
                  records they submitted will stay, but will no longer show who submitted them.
                </p>
                {deleteTarget.isActive && (
                  <p className="text-sm text-gray-500 mt-2">
                    Not sure? <span className="font-medium text-[#1B2340]">Deactivate</span> instead —
                    they can&apos;t log in, but nothing is lost and you can turn the account back on later.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteBusy}
                  className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                {deleteTarget.isActive && (
                  <button
                    onClick={handleDeactivateInstead}
                    disabled={deleteBusy}
                    className="px-4 py-2 rounded-md border border-[#C9962C] text-sm font-medium text-[#1B2340] hover:bg-[#C9962C]/10 disabled:opacity-60"
                  >
                    Deactivate instead
                  </button>
                )}
                <button
                  onClick={handleDeleteUser}
                  disabled={deleteBusy}
                  className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteBusy ? 'Working…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      <ImportUsersPanel
        open={showImport}
        onClose={() => setShowImport(false)}
        onFinished={() => loadUsers(search, 1)}
      />
      <Pagination
        currentPage={page}
        totalPages={pagination.pages}
        onPageChange={(p) => loadUsers(search, p)}
      />
    </div>
  )
}