import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AnalyticsDashboard from '../../components/AnalyticsDashboard'
import analyticsService from '../../services/analyticsService'

vi.mock('../../services/analyticsService', () => ({
    default: {
        getDashboard: vi.fn(),
    },
}))

// Stub the chart children so this test focuses on AnalyticsDashboard's
// own logic (loading/error/empty states, date range, prop-passing)
// rather than re-testing Recharts rendering.
vi.mock('../../components/Analytics/EventStats', () => ({
    default: ({ data }) => <div data-testid="event-stats">events:{data?.total ?? 'none'}</div>,
}))
vi.mock('../../components/Analytics/NewsletterStats', () => ({
    default: ({ data }) => <div data-testid="newsletter-stats">newsletters:{data?.total ?? 'none'}</div>,
}))
vi.mock('../../components/Analytics/UserActivityChart', () => ({
    default: ({ data }) => <div data-testid="activity-chart">activity:{data?.length ?? 0}</div>,
}))

const emptyStats = {
    events: { total: 0, approved: 0, pending: 0, rejected: 0, byType: {} },
    newsletters: { total: 0, published: 0, totalRecipients: 0, avgOpenRate: 0, avgClickRate: 0, byMonth: [] },
    activity: [
        { date: 'Mon', events: 0, newsletters: 0, templates: 0, users: 0 },
        { date: 'Tue', events: 0, newsletters: 0, templates: 0, users: 0 },
    ],
}

const realStats = {
    events: { total: 12, approved: 8, pending: 3, rejected: 1, byType: { Workshop: 5 } },
    newsletters: { total: 2, published: 2, totalRecipients: 500, avgOpenRate: 45, avgClickRate: 12, byMonth: [] },
    activity: [
        { date: 'Mon', events: 2, newsletters: 0, templates: 1, users: 3 },
        { date: 'Tue', events: 1, newsletters: 1, templates: 0, users: 2 },
    ],
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('AnalyticsDashboard — loading state', () => {
    it('shows skeleton placeholders while loading', async () => {
        let resolvePromise
        analyticsService.getDashboard.mockReturnValue(
            new Promise((resolve) => {
                resolvePromise = resolve
            })
        )

        const { container } = render(<AnalyticsDashboard />)

        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)

        resolvePromise({ data: emptyStats })
        await waitFor(() => {
            expect(container.querySelectorAll('.animate-pulse').length).toBe(0)
        })
    })
})

describe('AnalyticsDashboard — data loading', () => {
    it('calls getDashboard with the default date range (30) on mount', async () => {
        analyticsService.getDashboard.mockResolvedValue({ data: realStats })

        render(<AnalyticsDashboard />)

        await waitFor(() => {
            expect(analyticsService.getDashboard).toHaveBeenCalledWith('30')
        })
    })

    it('reloads with the new value when the date range is changed', async () => {
        analyticsService.getDashboard.mockResolvedValue({ data: realStats })

        render(<AnalyticsDashboard />)
        await screen.findByTestId('event-stats')

        fireEvent.change(screen.getByLabelText('Date range'), { target: { value: '7' } })

        await waitFor(() => {
            expect(analyticsService.getDashboard).toHaveBeenCalledWith('7')
        })
        expect(
            await screen.findByText('Events, newsletters, and activity for the last 7 days')
        ).toBeInTheDocument()
    })

    it('reloads when the refresh button is clicked', async () => {
        analyticsService.getDashboard.mockResolvedValue({ data: realStats })

        render(<AnalyticsDashboard />)
        await screen.findByTestId('event-stats')

        fireEvent.click(screen.getByTitle('Refresh'))

        await waitFor(() => {
            expect(analyticsService.getDashboard).toHaveBeenCalledTimes(2)
        })
    })
})

describe('AnalyticsDashboard — data rendering', () => {
    it('passes the correct data down to each child component', async () => {
        analyticsService.getDashboard.mockResolvedValue({ data: realStats })

        render(<AnalyticsDashboard />)

        expect(await screen.findByText('events:12')).toBeInTheDocument()
        expect(screen.getByText('newsletters:2')).toBeInTheDocument()
        expect(screen.getByText('activity:2')).toBeInTheDocument()
    })
})

describe('AnalyticsDashboard — empty state', () => {
    it('shows the empty state when all stats are zero', async () => {
        analyticsService.getDashboard.mockResolvedValue({ data: emptyStats })

        render(<AnalyticsDashboard />)

        expect(await screen.findByText('Nothing to show yet')).toBeInTheDocument()
        expect(screen.queryByTestId('event-stats')).not.toBeInTheDocument()
    })

    it('does not show the empty state if only some values are non-zero', async () => {
        analyticsService.getDashboard.mockResolvedValue({
            data: { ...emptyStats, events: { ...emptyStats.events, total: 1 } },
        })

        render(<AnalyticsDashboard />)

        await waitFor(() => {
            expect(screen.queryByText('Nothing to show yet')).not.toBeInTheDocument()
        })
        expect(screen.getByTestId('event-stats')).toBeInTheDocument()
    })
})

describe('AnalyticsDashboard — error state', () => {
    it('shows an error message and retry button when loading fails', async () => {
        analyticsService.getDashboard.mockRejectedValue(new Error('Network error'))

        render(<AnalyticsDashboard />)

        expect(
            await screen.findByText('Could not load analytics right now. Please try again.')
        ).toBeInTheDocument()
        expect(screen.getByText('Retry')).toBeInTheDocument()
        expect(screen.queryByTestId('event-stats')).not.toBeInTheDocument()
    })

    it('retries loading when the Retry button is clicked', async () => {
        analyticsService.getDashboard
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce({ data: realStats })

        render(<AnalyticsDashboard />)
        await screen.findByText('Retry')

        fireEvent.click(screen.getByText('Retry'))

        expect(await screen.findByTestId('event-stats')).toBeInTheDocument()
        expect(screen.queryByText('Could not load analytics right now. Please try again.')).not.toBeInTheDocument()
    })
})