import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UserManagementPage from '../../components/admin/UserManagementPage'
import userService from '../../services/userService'
import departmentService from '../../services/departmentService'

vi.mock('react-redux', () => ({
  useSelector: vi.fn((selector) => ({ _id: 'admin-current', role: 'SUPER_ADMIN' })),
}))

vi.mock('../../services/userService', () => ({
  default: {
    getAll: vi.fn(),
    create: vi.fn(),
    updateAccess: vi.fn(),
    updateRoles: vi.fn(),
    getSummary: vi.fn(() => Promise.resolve({ data: { total: 1, byRole: {} } })),
  },
}))

vi.mock('../../services/departmentService', () => ({
  default: {
    getAll: vi.fn(),
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
    clusters: ['AI'],
    sections: ['A'],
  },
]

const mockDepartments = [{ _id: 'dept1', name: 'Computer Science' }]

beforeEach(() => {
  vi.clearAllMocks()
  departmentService.getAll.mockResolvedValue({ data: mockDepartments })
})

describe('UserManagementPage', () => {
  it('loads and displays users on mount', async () => {
    userService.getAll.mockResolvedValue({
      data: mockUsers,
      pagination: { total: 1, pages: 1 },
    })

    render(<UserManagementPage />)

    expect(await screen.findByText('Jane Faculty')).toBeInTheDocument()
    expect(screen.getByText('jane@college.edu')).toBeInTheDocument()
    expect(screen.getAllByText('Computer Science').length).toBeGreaterThan(0)
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

  it('creates a new user with role and scope', async () => {
    userService.getAll.mockResolvedValue({ data: [], pagination: { total: 0, pages: 1 } })
    userService.create.mockResolvedValue({ data: { _id: 'user2' } })

    render(<UserManagementPage />)
    await screen.findByText('No users found.')

    fireEvent.click(screen.getByText('+ New User'))

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'New' } })
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Person' } })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@college.edu' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'SecurePass123' },
    })

    fireEvent.click(screen.getByText('Create User'))

    await waitFor(() => {
      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'New',
          lastName: 'Person',
          email: 'new@college.edu',
        })
      )
    });
  });

  it('opens the access editor pre-filled with the user’s current role and scope', async () => {
    userService.getAll.mockResolvedValue({
      data: mockUsers,
      pagination: { total: 1, pages: 1 },
    })

    render(<UserManagementPage />)
    await screen.findByText('Jane Faculty')

    fireEvent.click(screen.getByText('Edit Access'))

    expect(screen.getByText('Edit Access — Jane Faculty')).toBeInTheDocument()
    expect(screen.getByDisplayValue('AI')).toBeInTheDocument()
  });

  it('submits an access update', async () => {
    userService.getAll.mockResolvedValue({
      data: mockUsers,
      pagination: { total: 1, pages: 1 },
    })
    userService.updateAccess.mockResolvedValue({ data: mockUsers[0] })

    render(<UserManagementPage />)
    await screen.findByText('Jane Faculty')

    fireEvent.click(screen.getByText('Edit Access'))
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(userService.updateAccess).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ role: 'FACULTY' })
      )
    });
  });
})