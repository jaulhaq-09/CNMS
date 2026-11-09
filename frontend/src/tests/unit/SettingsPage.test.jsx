import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsPage from '../../components/admin/SettingsPage'
import settingsService from '../../services/settingsService'

vi.mock('../../services/settingsService', () => ({
  default: {
    get: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

const mockSettings = {
  instituteName: 'BMSITM',
  vision: 'To be the finest institution.',
  mission: 'Deliver quality education.',
  address: '123 College Road',
  phone: '080-1234',
  email: 'info@bmsit.in',
  website: 'https://bmsit.in',
  socialLinks: { twitter: '', facebook: '', linkedin: '', youtube: '' },
  editorialBoard: [{ name: 'Dr. Ambika R', role: 'Dean' }],
  principalName: 'Dr. Sanjay H A',
  principalTitle: 'Principal',
  currentVolume: 12,
  currentIssue: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SettingsPage', () => {
  it('shows a loading skeleton before settings arrive', () => {
    settingsService.get.mockReturnValue(new Promise(() => {})) // never resolves
    render(<SettingsPage />)
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  });

  it('loads and displays existing settings', async () => {
    settingsService.get.mockResolvedValue({ data: mockSettings })

    render(<SettingsPage />)

    expect(await screen.findByDisplayValue('BMSITM')).toBeInTheDocument()
    expect(screen.getByDisplayValue('To be the finest institution.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Dr. Sanjay H A')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Dr. Ambika R')).toBeInTheDocument()
  });

  it('shows an error message if loading fails', async () => {
    settingsService.get.mockRejectedValue({
      response: { data: { message: 'Could not reach settings' } },
    })

    render(<SettingsPage />)

    expect(await screen.findByText('Could not reach settings')).toBeInTheDocument()
  });

  it('submits updated field values', async () => {
    settingsService.get.mockResolvedValue({ data: mockSettings })
    settingsService.update.mockResolvedValue({ data: mockSettings })

    render(<SettingsPage />)
    await screen.findByDisplayValue('BMSITM')

    fireEvent.change(screen.getByLabelText('Institute Name'), {
      target: { value: 'BMSIT&M' },
    })
    fireEvent.click(screen.getByText('Save changes'))

    await waitFor(() => {
      expect(settingsService.update).toHaveBeenCalledWith(
        expect.objectContaining({ instituteName: 'BMSIT&M' })
      )
    });
  });

  it('adds a new editorial board member row', async () => {
    settingsService.get.mockResolvedValue({ data: mockSettings })

    render(<SettingsPage />)
    await screen.findByDisplayValue('Dr. Ambika R')

    fireEvent.click(screen.getByText('+ Add member'))

    const nameInputs = screen.getAllByPlaceholderText('Name')
    expect(nameInputs.length).toBe(2)
  });

  it('removes an editorial board member row', async () => {
    settingsService.get.mockResolvedValue({
      data: {
        ...mockSettings,
        editorialBoard: [
          { name: 'Dr. Ambika R', role: 'Dean' },
          { name: 'Dr. Surekha R Gondkar', role: 'Assoc. Prof.' },
        ],
      },
    })

    render(<SettingsPage />)
    await screen.findByDisplayValue('Dr. Ambika R')

    const removeButtons = screen.getAllByText('✕')
    fireEvent.click(removeButtons[0])

    expect(screen.queryByDisplayValue('Dr. Ambika R')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Dr. Surekha R Gondkar')).toBeInTheDocument()
  });

  it('filters out blank editorial board rows before submitting', async () => {
    settingsService.get.mockResolvedValue({ data: mockSettings })
    settingsService.update.mockResolvedValue({ data: mockSettings })

    render(<SettingsPage />)
    await screen.findByDisplayValue('Dr. Ambika R')

    fireEvent.click(screen.getByText('+ Add member'))
    fireEvent.click(screen.getByText('Save changes'))

    await waitFor(() => {
      expect(settingsService.update).toHaveBeenCalledWith(
        expect.objectContaining({
          editorialBoard: [{ name: 'Dr. Ambika R', role: 'Dean' }],
        })
      )
    });
  });

  it('shows an error toast if saving fails', async () => {
    settingsService.get.mockResolvedValue({ data: mockSettings })
    settingsService.update.mockRejectedValue({
      response: { data: { message: 'Only SUPER_ADMIN can update settings' } },
    })

    render(<SettingsPage />)
    await screen.findByDisplayValue('BMSITM')

    fireEvent.click(screen.getByText('Save changes'))

    expect(
      await screen.findByText('Only SUPER_ADMIN can update settings')
    ).toBeInTheDocument()
  });
})