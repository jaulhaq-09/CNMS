import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewsletterGeneratorPage from '../../pages/Newslettergeneratorpage'
import newsletterService from '../../services/newsletterService'
import templateService from '../../services/templateService'
import usePermissions from '../../hooks/usePermissions'

vi.mock('../../services/newsletterService', () => ({
    default: {
        generate: vi.fn(),
    },
}))

vi.mock('../../services/templateService', () => ({
    default: {
        getAll: vi.fn(),
    },
}))

vi.mock('../../hooks/usePermissions', () => ({
    default: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
    default: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-router-dom', () => ({
    Link: ({ children, to }) => <a href={to}>{children}</a>,
}))

const mockTemplates = [
    { _id: 'tpl1', name: 'Default', isMprTemplate: true },
    { _id: 'tpl2', name: 'Compact', isMprTemplate: false },
]

beforeEach(() => {
    vi.clearAllMocks()
    usePermissions.mockReturnValue({ can: () => true })
    templateService.getAll.mockResolvedValue({ data: mockTemplates })
})

describe('NewsletterGeneratorPage', () => {
    it('shows a permission-denied message when the user lacks NEWSLETTER_GENERATE', () => {
        usePermissions.mockReturnValue({ can: () => false })

        render(<NewsletterGeneratorPage />)

        expect(
            screen.getByText("You don't have permission to generate newsletters.")
        ).toBeInTheDocument()
    })

    it('loads templates into the dropdown on mount', async () => {
        render(<NewsletterGeneratorPage />)

        await waitFor(() => {
            expect(templateService.getAll).toHaveBeenCalled()
        })

        expect(await screen.findByText('Compact')).toBeInTheDocument()
    })

    it('shows a validation error if dates are missing on submit', async () => {
        render(<NewsletterGeneratorPage />)
        await screen.findByText('Compact')

        fireEvent.click(screen.getByRole('button', { name: 'Generate newsletter' }))

        expect(
            await screen.findByText('Choose a start and end date for the reporting period.')
        ).toBeInTheDocument()
        expect(newsletterService.generate).not.toHaveBeenCalled()
    })

    it('shows a validation error if start date is after end date', async () => {
        render(<NewsletterGeneratorPage />)
        await screen.findByText('Compact')

        fireEvent.change(screen.getByLabelText('Period start'), {
            target: { value: '2026-02-01' },
        })
        fireEvent.change(screen.getByLabelText('Period end'), {
            target: { value: '2026-01-01' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Generate newsletter' }))

        expect(
            await screen.findByText('The start date must be before the end date.')
        ).toBeInTheDocument()
        expect(newsletterService.generate).not.toHaveBeenCalled()
    })

    it('shows a confirm step instead of calling generate immediately', async () => {
        render(<NewsletterGeneratorPage />)
        await screen.findByText('Compact')

        fireEvent.change(screen.getByLabelText('Period start'), {
            target: { value: '2026-01-01' },
        })
        fireEvent.change(screen.getByLabelText('Period end'), {
            target: { value: '2026-01-31' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Generate newsletter' }))

        expect(await screen.findByText(/This will compile a draft for/)).toBeInTheDocument()
        expect(newsletterService.generate).not.toHaveBeenCalled()
    })

    it('calls newsletterService.generate only after confirming', async () => {
        newsletterService.generate.mockResolvedValue({
            data: {
                name: 'CNMS Newsletter — Volume 1, Issue 1',
                compiledHtml: '<p>Test content</p>',
                recipients: { totalCount: 5, departments: ['dept1'] },
            },
        })

        render(<NewsletterGeneratorPage />)
        await screen.findByText('Compact')

        fireEvent.change(screen.getByLabelText('Period start'), {
            target: { value: '2026-01-01' },
        })
        fireEvent.change(screen.getByLabelText('Period end'), {
            target: { value: '2026-01-31' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Generate newsletter' }))

        fireEvent.click(await screen.findByText('Confirm & generate'))

        await waitFor(() => {
            expect(newsletterService.generate).toHaveBeenCalledWith('2026-01-01', '2026-01-31', undefined)
        })

        expect(await screen.findByText('CNMS Newsletter — Volume 1, Issue 1')).toBeInTheDocument()
        expect(screen.getByText(/5 items included/)).toBeInTheDocument()
    })

    it('resets the confirm step if a date is changed after confirming was shown', async () => {
        render(<NewsletterGeneratorPage />)
        await screen.findByText('Compact')

        fireEvent.change(screen.getByLabelText('Period start'), {
            target: { value: '2026-01-01' },
        })
        fireEvent.change(screen.getByLabelText('Period end'), {
            target: { value: '2026-01-31' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Generate newsletter' }))
        await screen.findByText('Confirm & generate')

        fireEvent.change(screen.getByLabelText('Period start'), {
            target: { value: '2026-02-01' },
        })

        expect(screen.queryByText('Confirm & generate')).not.toBeInTheDocument()
    })

    it('shows the backend error message when generation fails', async () => {
        newsletterService.generate.mockRejectedValue({
            response: { data: { message: 'No approved content found for this period' } },
        })

        render(<NewsletterGeneratorPage />)
        await screen.findByText('Compact')

        fireEvent.change(screen.getByLabelText('Period start'), {
            target: { value: '2026-01-01' },
        })
        fireEvent.change(screen.getByLabelText('Period end'), {
            target: { value: '2026-01-31' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Generate newsletter' }))
        fireEvent.click(await screen.findByText('Confirm & generate'))

        expect(
            await screen.findByText('No approved content found for this period')
        ).toBeInTheDocument()
    })

    it('shows a warning when no templates exist', async () => {
        templateService.getAll.mockResolvedValue({ data: [] })

        render(<NewsletterGeneratorPage />)

        expect(
            await screen.findByText(/No templates found\. Generation will fail/)
        ).toBeInTheDocument()
    })
})