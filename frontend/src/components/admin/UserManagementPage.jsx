import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'
import { useSelector } from 'react-redux'
import React, { useState, useEffect } from 'react'
import userService from '../../services/userService'
import departmentService from '../../services/departmentService'
import Pagination from '../common/Pagination'
import clusterService from '../../services/clusterService'
import sectionService from '../../services/sectionService'
import ImportUsersPanel from './ImportUsersPanel'
import { SelectCell, ChecklistCell, TextCell } from './InlineCells'

const ROLES = ['SUPER_ADMIN', 'COORDINATOR', 'FACULTY', 'GUEST']

const ROLE_OPTIONS = [
  { key: 'ADMIN', dbRole: 'SUPER_ADMIN', label: 'ADMIN' },
  { key: 'COORDINATOR', dbRole: 'COORDINATOR', label: 'COORDINATOR' },
  { key: 'FACULTY', dbRole: 'FACULTY', label: 'FACULTY' },
]

const FILTER_TABS = [
  { key: '', label: 'All', filterRole: '' },
  { key: 'SUPER_ADMIN', label: 'Admin', filterRole: 'SUPER_ADMIN' },
  { key: 'COORDINATOR', label: 'Coordinator', filterRole: 'COORDINATOR' },
  { key: 'FACULTY', label: 'Faculty', filterRole: 'FACULTY' },
]

const ROLE_BADGE_STYLES = {
  SUPER_ADMIN: 'bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340]',
  COORDINATOR: 'bg-[#EFF4FF] text-[#1B2340]',
  FACULTY: 'bg-gray-100 text-gray-600',
  GUEST: 'bg-gray-50 text-gray-400',
}

const ROLE_LABELS = {
  SUPER_ADMIN: 'Admins',
  COORDINATOR: 'Coordinators',
  FACULTY: 'Faculty',
  GUEST: 'Awaiting role',
}

const EMPTY_CREATE_FORM = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'FACULTY',
  department: '',
  clusters: [],
  sections: [],
}

export default function UserManagementPage() {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const [roleFilter, setRoleFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM)
  const [saving, setSaving] = useState(false)

  const [editingUser, setEditingUser] = useState(null)
  const [accessForm, setAccessForm] = useState(null)

  const currentUser = useSelector((state) => state.auth?.user)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [resendingId, setResendingId] = useState(null)
  const [summary, setSummary] = useState(null)

  // "Faculty" button on a Coordinator row: who works under this coordinator
  const [teamFor, setTeamFor] = useState(null)
  const [team, setTeam] = useState([])
  const [teamLoading, setTeamLoading] = useState(false)

  const openTeam = async (user) => {
    setTeamFor(user)
    setTeam([])
    setTeamLoading(true)
    try {
      const res = await userService.getTeam(user._id)
      setTeam(res.data?.members || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load the faculty list')
      setTeamFor(null)
    } finally {
      setTeamLoading(false)
    }
  }

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
    role: 'COORDINATOR',
  })

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault()
    if (!quickForm.email || !quickForm.password) {
      toast.error('Email and password are required')
      return
    }
    setSaving(true)
    try {
      const rawUsername = quickForm.username.trim() || quickForm.email.split('@')[0]
      const parts = rawUsername.split(/[._ ]+/).filter(Boolean)
      const firstName = parts[0] || 'User'
      const lastName = parts.slice(1).join(' ') || '-'
      const chosenRole = quickForm.role || 'COORDINATOR'

      await userService.create({
        firstName,
        lastName,
        email: quickForm.email.trim(),
        password: quickForm.password,
        role: chosenRole,
        roles: [chosenRole],
        employeeId: quickForm.username.trim() || undefined,
      })
      toast.success('User added successfully')
      setQuickForm({ username: '', email: '', password: '', role: 'COORDINATOR' })
      loadUsers(search, 1)
      loadSummary()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add user')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleRole = async (user, targetRole) => {
    const currentRoles = Array.isArray(user.roles) && user.roles.length > 0
      ? [...user.roles]
      : [user.role || 'FACULTY']

    let nextRoles
    if (currentRoles.includes(targetRole)) {
      if (currentRoles.length === 1) {
        toast.error('A user must have at least one role.')
        return
      }
      nextRoles = currentRoles.filter((r) => r !== targetRole)
    } else {
      nextRoles = [...currentRoles, targetRole]
    }

    try {
      setUsers((prev) =>
        prev.map((u) =>
          u._id === user._id
            ? { ...u, roles: nextRoles, role: nextRoles[0] }
            : u
        )
      )
      await userService.updateRoles(user._id, nextRoles)
      toast.success(`Roles updated for ${user.firstName || user.email}`)
      loadSummary()
    } catch (err) {
      setUsers((prev) =>
        prev.map((u) =>
          u._id === user._id
            ? { ...u, roles: currentRoles, role: currentRoles[0] }
            : u
        )
      )
      toast.error(err.response?.data?.message || 'Failed to update roles')
    }
  }

  const handleToggleActive = async (user) => {
    if (user._id === (currentUser?._id || currentUser?.id)) {
      toast.error('You cannot change your own status.')
      return
    }
    const nextState = !user.isActive
    try {
      await userService.updateAccess(user._id, {
        role: user.role,
        department: user.department?._id || undefined,
        clusters: user.clusters || [],
        sections: user.sections || [],
        isActive: nextState,
      })
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, isActive: nextState } : u))
      )
      toast.success(nextState ? 'User activated' : 'User deactivated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update status')
    }
  }

  const handleResend = async (user) => {
    try {
      setResendingId(user._id)
      const res = await userService.resendCredentials(user._id)
      toast.success(res.message || 'Credentials sent')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend credentials')
    } finally {
      setResendingId(null)
    }
  }

  const [createClusterOptions, setCreateClusterOptions] = useState([])
  const [createSectionOptions, setCreateSectionOptions] = useState([])
  const [accessClusterOptions, setAccessClusterOptions] = useState([])
  const [accessSectionOptions, setAccessSectionOptions] = useState([])

  const handleCreateDepartmentChange = async (e) => {
    const departmentId = e.target.value
    setCreateForm((prev) => ({ ...prev, department: departmentId, clusters: [], sections: [] }))
    setCreateSectionOptions([])
    if (!departmentId) {
      setCreateClusterOptions([])
      return
    }
    try {
      const res = await clusterService.getByDepartment(departmentId)
      setCreateClusterOptions(res.data)
    } catch (err) {
      setCreateClusterOptions([])
    }
  }

  const toggleCreateCluster = (name) => {
    setCreateForm((prev) => ({
      ...prev,
      clusters: prev.clusters.includes(name)
        ? prev.clusters.filter((c) => c !== name)
        : [...prev.clusters, name],
    }))
  }

  const toggleCreateSection = (name) => {
    setCreateForm((prev) => ({
      ...prev,
      sections: prev.sections.includes(name)
        ? prev.sections.filter((s) => s !== name)
        : [...prev.sections, name],
    }))
  }

  useEffect(() => {
    const selectedIds = createClusterOptions
      .filter((c) => createForm.clusters.includes(c.name))
      .map((c) => c._id)
    if (selectedIds.length === 0) {
      setCreateSectionOptions([])
      return
    }
    Promise.all(selectedIds.map((id) => sectionService.getByCluster(id)))
      .then((results) => setCreateSectionOptions(results.flatMap((r) => r.data)))
      .catch(() => setCreateSectionOptions([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createForm.clusters, createClusterOptions])

  const handleAccessDepartmentChange = async (e) => {
    const departmentId = e.target.value
    setAccessForm((prev) => ({ ...prev, department: departmentId, clusters: [], sections: [] }))
    setAccessSectionOptions([])
    if (!departmentId) {
      setAccessClusterOptions([])
      return
    }
    try {
      const res = await clusterService.getByDepartment(departmentId)
      setAccessClusterOptions(res.data)
    } catch (err) {
      setAccessClusterOptions([])
    }
  }

  const toggleAccessCluster = (name) => {
    setAccessForm((prev) => ({
      ...prev,
      clusters: prev.clusters.includes(name)
        ? prev.clusters.filter((c) => c !== name)
        : [...prev.clusters, name],
    }))
  }

  const toggleAccessSection = (name) => {
    setAccessForm((prev) => ({
      ...prev,
      sections: prev.sections.includes(name)
        ? prev.sections.filter((s) => s !== name)
        : [...prev.sections, name],
    }))
  }

  useEffect(() => {
    if (!accessForm) return
    const selectedIds = accessClusterOptions
      .filter((c) => accessForm.clusters.includes(c.name))
      .map((c) => c._id)
    if (selectedIds.length === 0) {
      setAccessSectionOptions([])
      return
    }
    Promise.all(selectedIds.map((id) => sectionService.getByCluster(id)))
      .then((results) => setAccessSectionOptions(results.flatMap((r) => r.data)))
      .catch(() => setAccessSectionOptions([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessForm?.clusters, accessClusterOptions])

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
      if (departmentFilter) filters.department = departmentFilter
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
    } catch (err) {
      // non-fatal — dropdown just stays empty
    }
  }

  useEffect(() => {
    loadUsers(search, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, departmentFilter])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    loadUsers(search, 1)
  }

  const handleCreateChange = (e) => {
    setCreateForm({ ...createForm, [e.target.name]: e.target.value })
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError('')
      await userService.create({
        ...createForm,
        department: createForm.department || undefined,
      })
      toast.success('User created')
      setShowCreateForm(false)
      setCreateForm(EMPTY_CREATE_FORM)
      loadUsers(search)
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create user'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const openAccessEditor = async (user) => {
    setEditingUser(user)
    const departmentId = user.department?._id || ''
    setAccessForm({
      role: user.role,
      department: departmentId,
      clusters: user.clusters || [],
      sections: user.sections || [],
      isActive: user.isActive,
    })
    setAccessClusterOptions([])
    setAccessSectionOptions([])
    if (departmentId) {
      try {
        const res = await clusterService.getByDepartment(departmentId)
        setAccessClusterOptions(res.data)
      } catch (err) {
        setAccessClusterOptions([])
      }
    }
  }

  const closeAccessEditor = () => {
    setEditingUser(null)
    setAccessForm(null)
  }

  const handleAccessChange = (e) => {
    const { name, value, type, checked } = e.target
    setAccessForm({ ...accessForm, [name]: type === 'checkbox' ? checked : value })
  }

  // ---- Inline editing (click a cell) ----

  // Sends one change to the server together with the person's other
  // access values, and updates just that row on screen. Throws on failure
  // (after showing the message) so the cell can go back to its old value.
  const saveAccess = async (user, patch) => {
    const body = {
      role: user.role,
      department: user.department?._id || undefined,
      clusters: user.clusters || [],
      sections: user.sections || [],
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
            ? { ...u, ...patch, department, ...(cleared ? { role: 'GUEST' } : {}) }
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

  const saveDepartment = (user, departmentId) =>
    saveAccess(user, { department: departmentId || null, clusters: [], sections: [] })

  const saveClusters = (user, names) => {
    // If any cluster was removed, the old sections may no longer apply.
    const removed = (user.clusters || []).some((c) => !names.includes(c))
    return saveAccess(user, { clusters: names, sections: removed ? [] : user.sections || [] })
  }

  const loadClusterNames = async (user) => {
    const id = user.department?._id
    if (!id) return []
    const res = await clusterService.getByDepartment(id)
    return (res.data || []).map((c) => c.name)
  }

  const loadSectionNames = async (user) => {
    const id = user.department?._id
    if (!id) return []
    const res = await clusterService.getByDepartment(id)
    const mine = (res.data || []).filter((c) => (user.clusters || []).includes(c.name))
    const lists = await Promise.all(mine.map((c) => sectionService.getByCluster(c._id)))
    return [...new Set(lists.flatMap((r) => (r.data || []).map((s) => s.name)))]
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

  const handleAccessSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError('')
      await userService.updateAccess(editingUser._id, {
        role: accessForm.role,
        department: accessForm.department || undefined,
        clusters: accessForm.clusters,
        sections: accessForm.sections,
        isActive: accessForm.isActive,
      })
      toast.success('User access updated')
      closeAccessEditor()
      loadUsers(search)
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update user'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">User management</h1>
        <p className="text-sm text-gray-500 mt-1">Every login in the system, with who it belongs to.</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* Add User Card (Matches Screenshot 2) */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800">Add user</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Import from Excel
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="text-xs font-semibold px-3 py-1.5 rounded-md border border-indigo-200 text-[#4338CA] hover:bg-indigo-50 transition-colors cursor-pointer"
            >
              {showCreateForm ? 'Close Full Form' : '+ New User'}
            </button>
          </div>
        </div>

        <form onSubmit={handleQuickAddSubmit} className="flex flex-wrap items-center gap-3">
          <input
            name="username"
            value={quickForm.username}
            onChange={(e) => setQuickForm((prev) => ({ ...prev, username: e.target.value }))}
            placeholder="Username"
            className="flex-1 min-w-[140px] border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338CA]/30"
          />
          <input
            name="email"
            type="email"
            required
            value={quickForm.email}
            onChange={(e) => setQuickForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Email"
            className="flex-1 min-w-[180px] border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338CA]/30"
          />
          <input
            name="password"
            type="password"
            required
            value={quickForm.password}
            onChange={(e) => setQuickForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Password"
            className="flex-1 min-w-[140px] border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338CA]/30"
          />
          <select
            value={quickForm.role}
            onChange={(e) => setQuickForm((prev) => ({ ...prev, role: e.target.value }))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white min-w-[150px] font-medium"
          >
            <option value="COORDINATOR">COORDINATOR</option>
            <option value="SUPER_ADMIN">ADMIN</option>
            <option value="FACULTY">FACULTY</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="bg-[#4338CA] hover:bg-[#3730A3] text-white text-sm font-semibold px-6 py-2 rounded-md shadow-sm transition-all disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Adding…' : 'Add user'}
          </button>
        </form>
      </div>

      {/* Filter Tabs and Search Bar (Matches Screenshot 2) */}
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
                    ? 'bg-[#3b34c7] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
            className="flex-1 min-w-[200px] border border-gray-300 rounded-md px-3.5 py-1.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4338CA]/30"
          />
          <button
            type="submit"
            className="text-xs font-semibold px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="mb-6 p-5 border border-gray-200 rounded-lg bg-white shadow-sm"
        >
          <h2 className="text-lg font-semibold text-[#1B2340] mb-4">New User</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="user-firstName" className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
              <input
                id="user-firstName"
                name="firstName"
                value={createForm.firstName}
                onChange={handleCreateChange}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="user-lastName" className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
              <input
                id="user-lastName"
                name="lastName"
                value={createForm.lastName}
                onChange={handleCreateChange}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="user-email" className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                id="user-email"
                name="email"
                type="email"
                value={createForm.email}
                onChange={handleCreateChange}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="user-password" className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input
                id="user-password"
                name="password"
                type="password"
                value={createForm.password}
                onChange={handleCreateChange}
                required
                minLength={6}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="user-role" className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                id="user-role"
                name="role"
                value={createForm.role}
                onChange={handleCreateChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="user-department" className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select
                id="user-department"
                name="department"
                value={createForm.department}
                onChange={handleCreateDepartmentChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Clusters</label>
              {!createForm.department ? (
                <p className="text-xs text-gray-400">Select a department first.</p>
              ) : createClusterOptions.length === 0 ? (
                <p className="text-xs text-gray-400">No clusters set up for this department yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {createClusterOptions.map((c) => (
                    <label
                      key={c._id}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${createForm.clusters.includes(c.name)
                        ? 'bg-[#1B2340] text-white border-[#1B2340]'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#C9962C]/50'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={createForm.clusters.includes(c.name)}
                        onChange={() => toggleCreateCluster(c.name)}
                        className="hidden"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Sections</label>
              {createForm.clusters.length === 0 ? (
                <p className="text-xs text-gray-400">Select at least one cluster first.</p>
              ) : createSectionOptions.length === 0 ? (
                <p className="text-xs text-gray-400">No sections set up for the selected cluster(s) yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {createSectionOptions.map((s) => (
                    <label
                      key={s._id}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${createForm.sections.includes(s.name)
                        ? 'bg-[#1B2340] text-white border-[#1B2340]'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#C9962C]/50'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={createForm.sections.includes(s.name)}
                        onChange={() => toggleCreateSection(s.name)}
                        className="hidden"
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#C9962C] text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-[#C9962C]/90 disabled:opacity-60"
            >
              {saving ? 'Creating...' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-sm font-medium px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {editingUser && accessForm && (
        <form
          onSubmit={handleAccessSubmit}
          className="mb-6 p-5 border border-gray-200 rounded-lg bg-white shadow-sm"
        >
          <h2 className="text-lg font-semibold text-[#1B2340] mb-4">
            Edit Access — {editingUser.firstName} {editingUser.lastName}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="access-role" className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                id="access-role"
                name="role"
                value={accessForm.role}
                onChange={handleAccessChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="access-department" className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select
                id="access-department"
                name="department"
                value={accessForm.department}
                onChange={handleAccessDepartmentChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Clusters</label>
              {!accessForm.department ? (
                <p className="text-xs text-gray-400">Select a department first.</p>
              ) : accessClusterOptions.length === 0 ? (
                accessForm.clusters.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {accessForm.clusters.map((cName) => (
                      <label
                        key={cName}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer bg-[#1B2340] text-white border-[#1B2340]"
                      >
                        <input
                          type="checkbox"
                          value={cName}
                          checked={true}
                          readOnly
                          className="hidden"
                        />
                        {cName}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No clusters set up for this department yet.</p>
                )
              ) : (
                <div className="flex flex-wrap gap-2">
                  {accessClusterOptions.map((c) => (
                    <label
                      key={c._id}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${accessForm.clusters.includes(c.name)
                        ? 'bg-[#1B2340] text-white border-[#1B2340]'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#C9962C]/50'
                        }`}
                    >
                      <input
                        type="checkbox"
                        value={c.name}
                        checked={accessForm.clusters.includes(c.name)}
                        onChange={() => toggleAccessCluster(c.name)}
                        className="hidden"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Sections</label>
              {accessForm.clusters.length === 0 ? (
                <p className="text-xs text-gray-400">Select at least one cluster first.</p>
              ) : accessSectionOptions.length === 0 ? (
                <p className="text-xs text-gray-400">No sections set up for the selected cluster(s) yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {accessSectionOptions.map((s) => (
                    <label
                      key={s._id}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${accessForm.sections.includes(s.name)
                        ? 'bg-[#1B2340] text-white border-[#1B2340]'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#C9962C]/50'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={accessForm.sections.includes(s.name)}
                        onChange={() => toggleAccessSection(s.name)}
                        className="hidden"
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <input
                type="checkbox"
                name="isActive"
                checked={accessForm.isActive}
                onChange={handleAccessChange}
                id="isActive"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Account active
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#C9962C] text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-[#C9962C]/90 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={closeAccessEditor}
              className="text-sm font-medium px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">NAME</th>
              <th className="px-4 py-3">USERNAME</th>
              <th className="px-4 py-3">EMAIL</th>
              <th className="px-4 py-3">ROLES</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td colSpan={6} className="px-4 py-4">
                    <div className="h-3.5 w-1/3 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user._id} className="border-t border-gray-100 hover:bg-[#F5F6F8] transition-colors">
                  <td className="px-4 py-3 align-top font-medium text-[#1B2340]">
                    <div className="font-semibold text-gray-900">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {user.designation || user.department?.name || 'Faculty'}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs font-mono text-gray-700">
                    {user.employeeId || user.email?.split('@')[0] || '-'}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-gray-700">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1.5">
                      {ROLE_OPTIONS.map((opt) => {
                        const userRoles = Array.isArray(user.roles) && user.roles.length > 0
                          ? user.roles
                          : [user.role || 'FACULTY']
                        const checked =
                          userRoles.includes(opt.dbRole) ||
                          (opt.dbRole === 'SUPER_ADMIN' && user.role === 'SUPER_ADMIN')
                        const isSelf = user._id === (currentUser?._id || currentUser?.id)
                        const isSelfAdmin = isSelf && opt.dbRole === 'SUPER_ADMIN'

                        return (
                          <label
                            key={opt.key}
                            className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none hover:text-[#4338CA]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isSelfAdmin}
                              onChange={() => handleToggleRole(user, opt.dbRole)}
                              className="rounded border-gray-300 text-[#4338CA] focus:ring-[#4338CA] h-3.5 w-3.5 cursor-pointer disabled:opacity-50"
                            />
                            <span className={checked ? 'text-gray-900 font-bold' : 'text-gray-500 font-normal'}>
                              {opt.label}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex items-center justify-end gap-3 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => openAccessEditor(user)}
                        className="text-[#4338CA] hover:underline cursor-pointer"
                      >
                        Edit Access
                      </button>
                      {user.role === 'COORDINATOR' && (
                        <button
                          type="button"
                          onClick={() => openTeam(user)}
                          className="text-[#1B2340] hover:underline cursor-pointer"
                          title="See the faculty in this coordinator's clusters"
                        >
                          Faculty
                        </button>
                      )}
                      {user._id !== (currentUser?._id || currentUser?.id) && (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(user)}
                          className="text-amber-600 hover:underline cursor-pointer"
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                      {user._id === (currentUser?._id || currentUser?.id) ? (
                        <span className="text-gray-400">Your account</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(user)}
                          className="text-red-600 hover:underline cursor-pointer"
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
      {teamFor &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#101828]/40" onClick={() => setTeamFor(null)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="px-6 pt-5 pb-3 border-b border-gray-100">
                <h3 className="font-serif font-semibold text-lg text-[#1B2340]">
                  Faculty under {teamFor.firstName} {teamFor.lastName}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {teamFor.department?.name || 'No department'} ·{' '}
                  {(teamFor.clusters || []).join(', ') || 'no cluster'} · all sections
                </p>
              </div>

              <div className="px-6 py-4 overflow-y-auto">
                {teamLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : team.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    No faculty are assigned to this coordinator&apos;s clusters yet.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 mb-2">
                      {team.length} {team.length === 1 ? 'faculty member' : 'faculty members'}
                    </p>
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-gray-500">
                        <tr>
                          <th className="py-2 pr-3">Name</th>
                          <th className="py-2 pr-3">Email</th>
                          <th className="py-2 pr-3">Cluster</th>
                          <th className="py-2 pr-3">Section</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.map((m) => (
                          <tr key={m._id} className="border-t border-gray-100">
                            <td className="py-2 pr-3 font-medium text-[#1B2340]">
                              {m.firstName} {m.lastName}
                            </td>
                            <td className="py-2 pr-3">{m.email}</td>
                            <td className="py-2 pr-3">{(m.sharedClusters || []).join(', ') || '—'}</td>
                            <td className="py-2 pr-3">{(m.sections || []).join(', ') || '—'}</td>
                            <td className="py-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                                  }`}
                              >
                                {m.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>

              <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setTeamFor(null)}
                  className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Close
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