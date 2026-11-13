import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSelector } from 'react-redux'
import ReportPage from '../../pages/ReportPage'
import reportService from '../../services/reportService'

vi.mock('react-redux', () => ({ useSelector: vi.fn() }))
vi.mock('../../services/reportService', () => ({
  default: {
    getAll: vi.fn(),
  },
}))
vi.mock('../../hooks/usePermissions', () => ({
  default: () => ({ can: () => true }),
}))
vi.mock('../../components/report/CoordinatorClusterReport', () => ({
  default: () => <div>Coordinator report view</div>,
}))
vi.mock('../../components/report/AdminConsolidationCenter', () => ({
  default: () => <div>Admin consolidation view</div>,
}))
vi.mock('../../components/ExportCenter', () => ({ default: () => <div>Export view</div> }))
vi.mock('../../components/ReportBuilder', () => ({ default: () => <div>Builder view</div> }))
vi.mock('../../components/ReportsList', () => ({ default: () => <div>Reports list view</div> }))
vi.mock('../../components/ReportScheduler', () => ({
  default: () => <div>Scheduler view</div>,
}))

beforeEach(() => {
  vi.clearAllMocks()
  useSelector.mockImplementation((selector) =>
    selector({
      auth: {
        user: { role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN', 'COORDINATOR'] },
      },
    })
  )
  reportService.getAll.mockResolvedValue({ data: [] })
})

describe('ReportPage', () => {
  it('opens the Admin consolidation view for an Admin with multiple roles', () => {
    render(<ReportPage />)

    expect(screen.getByText('Admin consolidation view')).toBeInTheDocument()
    expect(screen.queryByText('Coordinator report view')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cluster Monthly Report' })).not.toBeInTheDocument()
    expect(reportService.getAll).not.toHaveBeenCalled()
  })

  it('loads personal reports only when the reports tab is opened', async () => {
    render(<ReportPage />)

    fireEvent.click(screen.getByRole('button', { name: 'My Reports' }))

    await waitFor(() => expect(reportService.getAll).toHaveBeenCalledWith(1, 20))
    expect(screen.getByText('Reports list view')).toBeInTheDocument()
  })
})
