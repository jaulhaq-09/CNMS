import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PostFacultyAchievementPage from '../pages/PostFacultyAchievementPage'
import facultyAchievementService from '../services/facultyAchievementService'

vi.mock('../services/facultyAchievementService', () => ({
  default: {
    create: vi.fn(),
    submit: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../hooks/usePermissions', () => ({
  default: () => ({ can: () => true }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

async function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'AICTE QIP PG Certification' },
  })
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Completed a certification program.' },
  })
  fireEvent.change(screen.getByLabelText('Date'), {
    target: { value: '2026-01-09' },
  })
}

describe('PostFacultyAchievementPage', () => {
  it('renders the form with default category', () => {
    render(<PostFacultyAchievementPage />)
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Category')).toHaveValue('CERTIFICATION')
  });

  it('only shows the Amount field for GRANT category', () => {
    render(<PostFacultyAchievementPage />)
    expect(screen.queryByLabelText('Amount (optional)')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'GRANT' } })
    expect(screen.getByLabelText('Amount (optional)')).toBeInTheDocument()
  });

  it('blocks submission until the verification checkbox is checked', async () => {
    render(<PostFacultyAchievementPage />)
    await fillRequiredFields()

    expect(screen.getByText('Submit achievement')).toBeDisabled()
    fireEvent.click(screen.getByText('Submit achievement'))

    expect(facultyAchievementService.create).not.toHaveBeenCalled()
  });

  it('submits successfully when verified and required fields are filled', async () => {
    facultyAchievementService.create.mockResolvedValue({ data: { _id: 'ach1', title: 'AICTE QIP PG Certification' } })
    facultyAchievementService.submit.mockResolvedValue({})

    render(<PostFacultyAchievementPage />)
    await fillRequiredFields()
    fireEvent.click(screen.getByLabelText(/I confirm I have verified/))

    fireEvent.click(screen.getByText('Submit achievement'))

    await waitFor(() => {
      expect(facultyAchievementService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'AICTE QIP PG Certification',
          category: 'CERTIFICATION',
        })
      )
      expect(facultyAchievementService.submit).toHaveBeenCalledWith('ach1')
    });
  });

  it('shows a success banner after submission', async () => {
    facultyAchievementService.create.mockResolvedValue({ data: { _id: 'ach1', title: 'My Award' } })
    facultyAchievementService.submit.mockResolvedValue({})

    render(<PostFacultyAchievementPage />)
    await fillRequiredFields()
    fireEvent.click(screen.getByLabelText(/I confirm I have verified/))
    fireEvent.click(screen.getByText('Submit achievement'))

    expect(await screen.findByText(/was submitted and is awaiting review/)).toBeInTheDocument()
  });

  it('shows an error message if submission fails', async () => {
    facultyAchievementService.create.mockRejectedValue({
      response: { data: { message: 'Validation failed' } },
    })

    render(<PostFacultyAchievementPage />)
    await fillRequiredFields()
    fireEvent.click(screen.getByLabelText(/I confirm I have verified/))
    fireEvent.click(screen.getByText('Submit achievement'))

    expect(await screen.findByText('Validation failed')).toBeInTheDocument()
  });
})