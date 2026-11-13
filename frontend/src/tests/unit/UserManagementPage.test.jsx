import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import UserManagementPage from '../../components/admin/UserManagementPage'
import userService from '../../services/userService'
import departmentService from '../../services/departmentService'
import clusterService from '../../services/clusterService'

vi.mock('react-redux', () => ({
  useSelector: vi.fn((selector) => ({ _id: 'admin-current', role: 'SUPER_ADMIN' })),
}))

vi.mock('../../services/userService', () => ({
  default: {
    getAll: vi.fn(),
    create: vi.fn(),
    updateAccess: vi.fn(),
    updateDetails: vi.fn(),
    updateRoles: vi.fn(),
    getSummary: vi.fn(() => Promise.resolve({ data: { total: 1, byRole: {} } })),
  },
}))

vi.mock('../../services/departmentService', () => ({
  default: {
    getAll: vi.fn(),
  },
}))

vi.mock('../../services/clusterService', () => ({
  default: {
    getByDepartment: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

const mockUsers = [
  {
    _id: 'user1',
    firstName: 'Jane',
    lastName: 'Faculty',
    email: 'jane@college.edu',
    role: 'FACULTY',
    department: { _id: 'dept1', name: 'Computer Science' },
    isActive: true,
    clusters: ['AI', 'Data Science'],
    sections: ['A'],
  },
]

const mockDepartments = [
  { _id: 'dept1', name: 'Computer Science' },
  { _id: 'dept2', name: 'Engineering' },
]

beforeEach(() => {
  vi.clearAllMocks()
  departmentService.getAll.mockResolvedValue({ data: mockDepartments })
  clusterService.getByDepartment.mockResolvedValue({
    data: [
      { name: 'AI' },
      { name: 'Data Science' },
      { name: 'cluster-1' },
      { name: 'cluster-2' },
    ],
  })
})

describe('UserManagementPage', () => {
  it('keeps Excel import alongside the add-user section heading', async () => {
    userService.getAll.mockResolvedValue({
      data: mockUsers,
      pagination: { total: 1, totalPages: 1, currentPage: 1 },
    })
    render(<UserManagementPage />)

    const addUserHeading = await screen.findByRole('heading', { name: 'Add user' })
    expect(
      within(addUserHeading.closest('section')).getByRole('button', { name: 'Import from Excel' })
    ).toBeInTheDocument()
  })

  it('loads and displays users on mount', async () => {
    userService.getAll.mockResolvedValue({
      data: mockUsers,
      pagination: { total: 1, pages: 1 },
    })

    render(<UserManagementPage />)

    expect(await screen.findByText('Jane Faculty')).toBeInTheDocument()
    expect(screen.getByText('jane@college.edu')).toBeInTheDocument()
    expect(screen.getAllByText('Computer Science').length).toBeGreaterThan(0)
    expect(screen.getByText('No cluster')).toBeInTheDocument()
    expect(screen.queryByText('AI, Data Science')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jane Faculty' }).closest('td').textContent.trim())
      .toBe('Jane Faculty')
    expect(screen.queryByRole('button', { name: 'Faculty' })).not.toBeInTheDocument()
  });

  it('shows an empty state when there are no users', async () => {
    userService.getAll.mockResolvedValue({ data: [], pagination: { total: 0, pages: 1 } })

    render(<UserManagementPage />)

    expect(await screen.findByText('No users found.')).toBeInTheDocument()
  });

  it('searches users by term', async () => {
    userService.getAll.mockResolvedValue({ data: [], pagination: { total: 0, pages: 1 } })

    render(<UserManagementPage />)
    await screen.findByText('No users found.')

    fireEvent.change(screen.getByPlaceholderText('Search by name or email...'), {
      target: { value: 'jane' },
    })
    fireEvent.click(screen.getByText('Search'))

    await waitFor(() => {
      expect(userService.getAll).toHaveBeenCalledWith({ search: 'jane' }, 1)
    });
  });

  it('creates a user from the single add-user form with the selected role and department', async () => {
    userService.getAll.mockResolvedValue({ data: [], pagination: { total: 0, pages: 1 } })
    userService.create.mockResolvedValue({ data: { _id: 'user2' } })

    render(<UserManagementPage />)
    await screen.findByText('No users found.')

    expect(screen.queryByText('+ New User')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'new.person' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@college.edu' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'SecurePass123' } })
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'FACULTY' } })
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'dept1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }))

    await waitFor(() => {
      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'new',
          lastName: 'person',
          employeeId: 'new.person',
          email: 'new@college.edu',
          role: 'FACULTY',
          department: 'dept1',
        })
      )
    });
  });

  it('requires an explicit role in the quick-add form', async () => {
    userService.getAll.mockResolvedValue({ data: [], pagination: { total: 0, pages: 1 } })
    userService.create.mockResolvedValue({ data: { _id: 'user2' } })

    render(<UserManagementPage />)
    await screen.findByText('No users found.')

    const roleSelect = screen.getByLabelText('Role')
    expect(roleSelect).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@college.edu' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'SecurePass123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }))

    expect(userService.create).not.toHaveBeenCalled()

    fireEvent.change(roleSelect, { target: { value: 'FACULTY' } })
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'dept1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }))
    await waitFor(() => {
      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@college.edu', role: 'FACULTY' })
      )
    })

  })

  it('requires and saves cluster assignments when creating a Coordinator', async () => {
    userService.getAll.mockResolvedValue({ data: [], pagination: { total: 0, pages: 1 } })
    userService.create.mockResolvedValue({ data: { _id: 'coordinator2' } })

    render(<UserManagementPage />)
    await screen.findByText('No users found.')
    await waitFor(() => expect(clusterService.getByDepartment).toHaveBeenCalledWith('dept1'))

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'new.coordinator' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coord2@college.edu' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'SecurePass123' } })
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'COORDINATOR' } })
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'dept1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Select clusters' }))
    fireEvent.click(await screen.findByLabelText('cluster-1'))
    fireEvent.mouseDown(document.body)
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }))

    await waitFor(() => {
      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'COORDINATOR',
          department: 'dept1',
          clusters: ['cluster-1'],
        })
      )
    })
  })

  it('lets an admin assign a cluster to an existing Coordinator from the table', async () => {
    userService.getAll.mockResolvedValue({
      data: [{
        ...mockUsers[0],
        firstName: 'Jaul',
        lastName: 'Haq',
        role: 'GUEST',
        roles: ['GUEST', 'COORDINATOR'],
        clusters: [],
      }],
      pagination: { total: 1, pages: 1 },
    })
    userService.updateAccess.mockResolvedValue({ data: {} })

    render(<UserManagementPage />)
    await screen.findByText('Jaul Haq')
    await waitFor(() => expect(clusterService.getByDepartment).toHaveBeenCalledWith('dept1'))

    fireEvent.click(screen.getByRole('button', { name: 'No cluster' }))
    fireEvent.click(await screen.findByLabelText('cluster-1'))
    fireEvent.mouseDown(document.body)

    await waitFor(() => {
      expect(userService.updateAccess).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ clusters: ['cluster-1'], role: 'GUEST' })
      )
    })
  })

  it('offers a No cluster choice that clears an existing cluster assignment', async () => {
    userService.getAll.mockResolvedValue({
      data: [{
        ...mockUsers[0],
        clusters: ['cluster-1'],
      }],
      pagination: { total: 1, pages: 1 },
    })
    userService.updateAccess.mockResolvedValue({ data: {} })

    render(<UserManagementPage />)
    await screen.findByText('Jane Faculty')
    fireEvent.click(screen.getByRole('button', { name: 'cluster-1' }))

    const noClusterOption = await screen.findByLabelText('No cluster')
    expect(noClusterOption).not.toBeChecked()
    fireEvent.click(noClusterOption)
    fireEvent.mouseDown(document.body)

    await waitFor(() => {
      expect(userService.updateAccess).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ clusters: [] })
      )
    })
    expect(screen.queryByLabelText('No cluster')).not.toBeInTheDocument()
  })

  it('saves name and username changes after leaving each cell', async () => {
    userService.getAll.mockResolvedValue({ data: mockUsers, pagination: { total: 1, pages: 1 } })
    userService.updateDetails.mockResolvedValue({ message: 'Details updated', data: {} })

    render(<UserManagementPage />)
    await screen.findByText('Jane Faculty')

    fireEvent.click(screen.getByRole('button', { name: 'Jane Faculty' }))
    fireEvent.change(screen.getByDisplayValue('Jane Faculty'), { target: { value: 'Jane New' } })
    fireEvent.blur(screen.getByDisplayValue('Jane New'))

    await waitFor(() => {
      expect(userService.updateDetails).toHaveBeenCalledWith('user1', { name: 'Jane New' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'jane' }))
    fireEvent.change(screen.getByDisplayValue('jane'), { target: { value: 'jane-new' } })
    fireEvent.blur(screen.getByDisplayValue('jane-new'))

    await waitFor(() => {
      expect(userService.updateDetails).toHaveBeenCalledWith('user1', { employeeId: 'jane-new' })
    })
  })

  it('saves edited user details after clicking outside the cell', async () => {
    userService.getAll.mockResolvedValue({
      data: mockUsers,
      pagination: { total: 1, pages: 1 },
    })
    userService.updateDetails.mockResolvedValue({
      message: 'Details updated',
      data: { _id: 'user1', email: 'jane.new@college.edu' },
    })

    render(<UserManagementPage />)
    await screen.findByText('jane@college.edu')

    fireEvent.click(screen.getByText('jane@college.edu'))
    fireEvent.change(screen.getByDisplayValue('jane@college.edu'), {
      target: { value: 'jane.new@college.edu' },
    })
    fireEvent.blur(screen.getByDisplayValue('jane.new@college.edu'))

    await waitFor(() => {
      expect(userService.updateDetails).toHaveBeenCalledWith('user1', { email: 'jane.new@college.edu' })
    })
  });

  it('saves role changes when clicking outside the role cell', async () => {
    userService.getAll.mockResolvedValue({
      data: mockUsers,
      pagination: { total: 1, pages: 1 },
    })
    userService.updateRoles.mockResolvedValue({ data: mockUsers[0] })

    render(<UserManagementPage />)
    await screen.findByText('Jane Faculty')

    fireEvent.click(screen.getByRole('button', { name: 'FACULTY' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'ADMIN' }))
    fireEvent.mouseDown(screen.getByRole('heading', { name: 'Add user' }))
    fireEvent.click(screen.getByRole('heading', { name: 'Add user' }))

    await waitFor(() => {
      expect(userService.updateRoles).toHaveBeenCalledWith('user1', ['FACULTY', 'SUPER_ADMIN'])
    });
  });

  it('saves a status change after leaving the status cell', async () => {
    userService.getAll.mockResolvedValue({ data: mockUsers, pagination: { total: 1, pages: 1 } })
    userService.updateAccess.mockResolvedValue({ data: mockUsers[0] })

    render(<UserManagementPage />)
    await screen.findByText('Jane Faculty')

    fireEvent.click(screen.getByRole('button', { name: 'Active' }))
    const statusSelect = screen.getAllByRole('combobox').find((select) =>
      Array.from(select.options).some((option) => option.value === 'inactive')
    )
    fireEvent.change(statusSelect, { target: { value: 'inactive' } })
    fireEvent.blur(statusSelect)

    await waitFor(() => {
      expect(userService.updateAccess).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ isActive: false })
      )
    })
  })

  it('displays and saves a changed department from the department column', async () => {
    userService.getAll.mockResolvedValue({ data: mockUsers, pagination: { total: 1, pages: 1 } })
    userService.updateAccess.mockResolvedValue({ data: mockUsers[0] })

    render(<UserManagementPage />)
    await screen.findByText('Jane Faculty')

    fireEvent.click(screen.getByRole('button', { name: 'Computer Science' }))
    const departmentSelect = screen.getByRole('table').querySelector('tbody select')
    fireEvent.change(departmentSelect, { target: { value: 'dept2' } })
    fireEvent.blur(departmentSelect)

    await waitFor(() => {
      expect(userService.updateAccess).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          role: 'FACULTY',
          department: 'dept2',
          clusters: [],
          sections: [],
        })
      )
    })
  })

  it('does not show the Edit Access action', async () => {
    userService.getAll.mockResolvedValue({ data: mockUsers, pagination: { total: 1, pages: 1 } })

    render(<UserManagementPage />)
    await screen.findByText('Jane Faculty')

    expect(screen.queryByText('Edit Access')).not.toBeInTheDocument()
  })
})