import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PostPatentPage from '../pages/PostPatentPage'
import patentService from '../services/patentService'

vi.mock('../services/patentService', () => ({
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
  fireEvent.change(screen.getByLabelText('Patent title'), {
    target: { value: 'AI-Enabled Automatic Trolley' },
  })
  fireEvent.change(screen.getByLabelText('Inventor 1'), {
    target: { value: 'Dr. Shivakumara T' },
  })
  fireEvent.change(screen.getByLabelText('Granting authority'), {
    target: { value: 'Intellectual Property Office of India' },
  })
}

describe('PostPatentPage', () => {
  it('renders with APPLIED as the default status', () => {
    render(<PostPatentPage />)
    expect(screen.getByLabelText('Status')).toHaveValue('APPLIED')
    expect(screen.queryByLabelText('Grant date')).not.toBeInTheDocument()
  });

  it('shows the Grant date field only when status is GRANTED', () => {
    render(<PostPatentPage />)
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'GRANTED' } })
    expect(screen.getByLabelText('Grant date')).toBeInTheDocument()
  });

  it('can add and remove inventor rows', () => {
    render(<PostPatentPage />)
    expect(screen.getAllByPlaceholderText('Inventor name').length).toBe(1)

    fireEvent.click(screen.getByText('+ Add inventor'))
    expect(screen.getAllByPlaceholderText('Inventor name').length).toBe(2)

    fireEvent.click(screen.getAllByText('✕')[0])
    expect(screen.getAllByPlaceholderText('Inventor name').length).toBe(1)
  });

  it('rejects submission with a blank inventor', async () => {
    render(<PostPatentPage />)
    fireEvent.change(screen.getByLabelText('Patent title'), {
      target: { value: 'Some Patent' },
    })
    fireEvent.change(screen.getByLabelText('Granting authority'), {
      target: { value: 'IPO India' },
    })
    fireEvent.click(screen.getByLabelText(/I confirm I have verified/))

    fireEvent.click(screen.getByText('Submit patent'))

    expect(await screen.findByText('At least one inventor is required.')).toBeInTheDocument()
    expect(patentService.create).not.toHaveBeenCalled()
  });

  it('blocks submission until verified', async () => {
    render(<PostPatentPage />)
    await fillRequiredFields()

    expect(screen.getByText('Submit patent')).toBeDisabled()
    fireEvent.click(screen.getByText('Submit patent'))

    expect(patentService.create).not.toHaveBeenCalled()
  });

  it('submits successfully with valid data', async () => {
    patentService.create.mockResolvedValue({ data: { _id: 'pat1', title: 'AI-Enabled Automatic Trolley' } })
    patentService.submit.mockResolvedValue({})

    render(<PostPatentPage />)
    await fillRequiredFields()
    fireEvent.click(screen.getByLabelText(/I confirm I have verified/))

    fireEvent.click(screen.getByText('Submit patent'))

    await waitFor(() => {
      expect(patentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'AI-Enabled Automatic Trolley',
          inventors: ['Dr. Shivakumara T'],
          grantStatus: 'APPLIED',
        })
      )
      expect(patentService.submit).toHaveBeenCalledWith('pat1')
    });
  });

  it('shows an error message if submission fails', async () => {
    patentService.create.mockRejectedValue({
      response: { data: { message: 'Granting authority is required' } },
    })

    render(<PostPatentPage />)
    await fillRequiredFields()
    fireEvent.click(screen.getByLabelText(/I confirm I have verified/))
    fireEvent.click(screen.getByText('Submit patent'))

    expect(await screen.findByText('Granting authority is required')).toBeInTheDocument()
  });
})