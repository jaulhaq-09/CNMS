import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DepartmentManagementPage from '../../components/admin/DepartmentManagementPage'
import departmentService from '../../services/departmentService'

vi.mock('../../services/departmentService', () => ({
  default: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

const mockDepartments = [
  {
    _id: 'dept1',
    name: 'Computer Science',
    code: 'CS',
    isActive: true,
    head: null,
  },
  {
    _id: 'dept2',
    name: 'Mathematics',
    code: 'MATH',
    isActive: false,
    head: null,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  window.confirm = vi.fn(() => true)
})

describe('DepartmentManagementPage', () => {
  it('loads and displays departments on mount', async () => {
    departmentService.getAll.mockResolvedValue({ data: mockDepartments })

    render(<DepartmentManagementPage />)

    expect(await screen.findByText('Computer Science')).toBeInTheDocument()
    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('CS')).toBeInTheDocument()
  });

  it('shows an empty state when there are no departments', async () => {
    departmentService.getAll.mockResolvedValue({ data: [] })

    render(<DepartmentManagementPage />)

    expect(await screen.findByText('No departments yet.')).toBeInTheDocument()
  });

  it('shows an error message if loading fails', async () => {
    departmentService.getAll.mockRejectedValue({
      response: { data: { message: 'Server exploded' } },
    })

    render(<DepartmentManagementPage />)

    expect(await screen.findByText('Server exploded')).toBeInTheDocument()
  });

  it('opens the create form and submits a new department', async () => {
    departmentService.getAll.mockResolvedValue({ data: [] })
    departmentService.create.mockResolvedValue({ data: { _id: 'dept3' } })

    render(<DepartmentManagementPage />)
    await screen.findByText('No departments yet.')

    fireEvent.click(screen.getByText('+ New Department'))

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Physics' },
    })
    fireEvent.change(screen.getByLabelText('Code'), {
      target: { value: 'PHY' },
    })

    fireEvent.click(screen.getByText('Create Department'))

    await waitFor(() => {
      expect(departmentService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Physics', code: 'PHY' })
      )
    });
  });

  it('opens the edit form pre-filled with existing values', async () => {
    departmentService.getAll.mockResolvedValue({ data: mockDepartments });

    render(<DepartmentManagementPage />);
    await screen.findByText('Computer Science');

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(screen.getByDisplayValue('Computer Science')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CS')).toBeInTheDocument();
  });

  it('deactivates a department after confirming', async () => {
    departmentService.getAll.mockResolvedValue({ data: mockDepartments });
    departmentService.delete.mockResolvedValue({});

    render(<DepartmentManagementPage />);
    await screen.findByText('Computer Science');

    fireEvent.click(screen.getByText('Deactivate'));
    fireEvent.click(await screen.findByText('Yes'));

    await waitFor(() => {
      expect(departmentService.delete).toHaveBeenCalledWith('dept1');
    });
  });

  it('does not call delete if the confirmation is cancelled', async () => {
    departmentService.getAll.mockResolvedValue({ data: mockDepartments });

    render(<DepartmentManagementPage />);
    await screen.findByText('Computer Science');

    fireEvent.click(screen.getByText('Deactivate'));
    fireEvent.click(await screen.findByText('Cancel'));

    expect(departmentService.delete).not.toHaveBeenCalled();
  });
})