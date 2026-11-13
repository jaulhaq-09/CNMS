import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../services/api'
import reportService from '../../services/reportService'

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: { success: true, data: [] } })
})

describe('reportService', () => {
  it('omits empty optional filters from the approved activities request', async () => {
    await reportService.getApprovedActivities({ cluster: undefined, department: null })

    expect(api.get).toHaveBeenCalledWith('/api/reports/coordinator/approved-activities')
  })

  it('includes filters that were supplied', async () => {
    await reportService.getApprovedActivities({ cluster: 'AI' })

    expect(api.get).toHaveBeenCalledWith(
      '/api/reports/coordinator/approved-activities?cluster=AI'
    )
  })
})
