import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ExportOptions from '../../components/ExportOptions'
import exportService from '../../services/exportService'

vi.mock('../../services/exportService', () => ({
    default: {
        exportEvents: vi.fn(),
        exportNewsletters: vi.fn(),
        exportPublications: vi.fn(),
        exportPatents: vi.fn(),
        exportFacultyAchievements: vi.fn(),
        exportNptelCourses: vi.fn(),
        downloadFile: vi.fn(),
    },
}))

vi.mock('react-hot-toast', () => ({
    default: { success: vi.fn(), error: vi.fn() },
}))

const mockBlob = new Blob(['test'], { type: 'text/csv' })

beforeEach(() => {
    vi.clearAllMocks()
})

function renderWithType(exportType) {
    const onLoading = vi.fn()
    render(<ExportOptions exportType={exportType} onLoading={onLoading} loading={false} />)
    return { onLoading }
}

describe('ExportOptions — dispatch per type', () => {
    it('calls exportEvents when exportType is "events"', async () => {
        exportService.exportEvents.mockResolvedValue({ data: mockBlob })
        renderWithType('events')

        fireEvent.click(screen.getByText('Export as CSV'))

        await waitFor(() => {
            expect(exportService.exportEvents).toHaveBeenCalledWith({}, 'CSV')
        })
        expect(exportService.downloadFile).toHaveBeenCalled()
    })

    it('calls exportNewsletters when exportType is "newsletters"', async () => {
        exportService.exportNewsletters.mockResolvedValue({ data: mockBlob })
        renderWithType('newsletters')

        fireEvent.click(screen.getByText('Export as CSV'))

        await waitFor(() => {
            expect(exportService.exportNewsletters).toHaveBeenCalledWith({}, 'CSV')
        })
    })

    it('calls exportPublications when exportType is "publications"', async () => {
        exportService.exportPublications.mockResolvedValue({ data: mockBlob })
        renderWithType('publications')

        fireEvent.click(screen.getByText('Export as CSV'))

        await waitFor(() => {
            expect(exportService.exportPublications).toHaveBeenCalledWith({}, 'CSV')
        })
    })

    it('calls exportPatents when exportType is "patents"', async () => {
        exportService.exportPatents.mockResolvedValue({ data: mockBlob })
        renderWithType('patents')

        fireEvent.click(screen.getByText('Export as CSV'))

        await waitFor(() => {
            expect(exportService.exportPatents).toHaveBeenCalledWith({}, 'CSV')
        })
    })

    it('calls exportFacultyAchievements when exportType is "facultyAchievements"', async () => {
        exportService.exportFacultyAchievements.mockResolvedValue({ data: mockBlob })
        renderWithType('facultyAchievements')

        fireEvent.click(screen.getByText('Export as CSV'))

        await waitFor(() => {
            expect(exportService.exportFacultyAchievements).toHaveBeenCalledWith({}, 'CSV')
        })
    })

    it('calls exportNptelCourses when exportType is "nptelCourses"', async () => {
        exportService.exportNptelCourses.mockResolvedValue({ data: mockBlob })
        renderWithType('nptelCourses')

        fireEvent.click(screen.getByText('Export as CSV'))

        await waitFor(() => {
            expect(exportService.exportNptelCourses).toHaveBeenCalledWith({}, 'CSV')
        })
    })
})

describe('ExportOptions — format selection', () => {
    it('defaults to CSV format', () => {
        renderWithType('events')
        expect(screen.getByText('Export as CSV')).toBeInTheDocument()
    })

    it('switches to EXCEL and passes it to the export call', async () => {
        exportService.exportEvents.mockResolvedValue({ data: mockBlob })
        renderWithType('events')

        fireEvent.click(screen.getByRole('button', { name: 'EXCEL' }))
        expect(screen.getByText('Export as EXCEL')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Export as EXCEL'))

        await waitFor(() => {
            expect(exportService.exportEvents).toHaveBeenCalledWith({}, 'EXCEL')
        })
    })

    it('switches to PDF and passes it to the export call', async () => {
        exportService.exportEvents.mockResolvedValue({ data: mockBlob })
        renderWithType('events')

        fireEvent.click(screen.getByRole('button', { name: 'PDF' }))
        fireEvent.click(screen.getByText('Export as PDF'))

        await waitFor(() => {
            expect(exportService.exportEvents).toHaveBeenCalledWith({}, 'PDF')
        })
    })
})

describe('ExportOptions — NPTEL status filter hidden', () => {
    it('shows the Status filter for events', () => {
        renderWithType('events')
        expect(screen.getByLabelText('Status')).toBeInTheDocument()
    })

    it('hides the Status filter for nptelCourses (no status field on that model)', () => {
        renderWithType('nptelCourses')
        expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
    })
})

describe('ExportOptions — filters', () => {
    it('shows "Clear filters" only once a filter is set, and clears them on click', () => {
        renderWithType('events')

        expect(screen.queryByText('Clear filters')).not.toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Date From'), {
            target: { value: '2026-01-01' },
        })

        expect(screen.getByText('Clear filters')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Clear filters'))

        expect(screen.getByLabelText('Date From').value).toBe('')
        expect(screen.queryByText('Clear filters')).not.toBeInTheDocument()
    })

    it('includes date filters in the export call', async () => {
        exportService.exportEvents.mockResolvedValue({ data: mockBlob })
        renderWithType('events')

        fireEvent.change(screen.getByLabelText('Date From'), {
            target: { value: '2026-01-01' },
        })
        fireEvent.change(screen.getByLabelText('Date To'), {
            target: { value: '2026-01-31' },
        })

        fireEvent.click(screen.getByText('Export as CSV'))

        await waitFor(() => {
            expect(exportService.exportEvents).toHaveBeenCalledWith(
                { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
                'CSV'
            )
        })
    })

    it('includes status filter in the export call when set', async () => {
        exportService.exportEvents.mockResolvedValue({ data: mockBlob })
        renderWithType('events')

        fireEvent.change(screen.getByLabelText('Status'), {
            target: { value: 'APPROVED' },
        })

        fireEvent.click(screen.getByText('Export as CSV'))

        await waitFor(() => {
            expect(exportService.exportEvents).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'APPROVED' }),
                'CSV'
            )
        })
    })
})

describe('ExportOptions — error handling', () => {
    it('shows an error message when export fails', async () => {
        exportService.exportEvents.mockRejectedValue({
            response: { data: { message: 'Export service unavailable' } },
        })
        renderWithType('events')

        fireEvent.click(screen.getByText('Export as CSV'))

        expect(await screen.findByText('Export service unavailable')).toBeInTheDocument()
    })

    it('calls onLoading(true) then onLoading(false) around the export', async () => {
        exportService.exportEvents.mockResolvedValue({ data: mockBlob })
        const { onLoading } = renderWithType('events')

        fireEvent.click(screen.getByText('Export as CSV'))

        await waitFor(() => {
            expect(onLoading).toHaveBeenCalledWith(true)
            expect(onLoading).toHaveBeenCalledWith(false)
        })
    })
})