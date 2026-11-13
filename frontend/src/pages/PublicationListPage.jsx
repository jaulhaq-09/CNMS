import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import publicationService from '../services/publicationService'
import Pagination from '../components/common/Pagination'
import { TYPE_LABELS } from '../utils/citation'
import toast from 'react-hot-toast'
import exportService from '../services/exportService'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS } from '../config/permissions'
import PageHeader from '../components/common/PageHeader'

const STATUS_STYLES = {
  DRAFT: 'bg-[#F2F4F7] text-[#667085]',
  SUBMITTED: 'bg-[#FBF3E7] text-[#B07C1F]',
  APPROVED: 'bg-[#ECFDF3] text-[#067647]',
  REJECTED: 'bg-[#FEF3F2] text-[#B42318]',
  PUBLISHED: 'bg-[#EFF4FF] text-[#1B2340]',
}

export default function PublicationListPage() {
  const [publications, setPublications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ totalPages: 1 })
  const [exporting, setExporting] = useState(false)
  const { can } = usePermissions()
  const canExport = can(PERMISSIONS.EXPORT_VIEW)

  const load = useCallback(
    async (pageNum = 1) => {
      try {
        setLoading(true)
        setError('')
        const filters = statusFilter ? { status: statusFilter } : {}
        const response = await publicationService.getAll(filters, pageNum, 10)
        setPublications(response.data)
        setPagination({ totalPages: response.pagination?.totalPages || 1 })
        setPage(pageNum)
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load publications.')
      } finally {
        setLoading(false)
      }
    },
    [statusFilter]
  )

  useEffect(() => {
    load(1)
  }, [load])

  const handleExport = async () => {
    try {
      setExporting(true)
      const filters = statusFilter ? { status: statusFilter } : {}
      const response = await exportService.exportPublications(filters, 'EXCEL')
      exportService.downloadFile(response.data, `publications_${Date.now()}.xlsx`)
      toast.success('Publications exported')
    } catch (err) {
      toast.error('Could not export publications.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Publications"
        description="Journal papers, conference papers, book chapters and books submitted across departments."
      >
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-[#E4E7EC] rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#C9962C]"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          {canExport && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              title="Download these publications as an Excel file"
              className="text-sm font-medium px-4 py-2 rounded-md border border-[#C9962C] text-[#1B2340] hover:bg-[#C9962C]/10 disabled:opacity-60"
            >
              {exporting ? 'Exporting…' : 'Export Excel'}
            </button>
          )}
      </PageHeader>

      {error && <p className="text-sm text-[#B42318]">{error}</p>}

      {loading ? (
        <div className="bg-white border border-[#E4E7EC] rounded-lg divide-y divide-[#E4E7EC]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="h-3.5 w-1/2 bg-[#F2F4F7] rounded animate-pulse" />
              <div className="h-2.5 w-1/3 bg-[#F2F4F7] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : publications.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E4E7EC] rounded-lg p-10 text-center">
          <p className="text-sm text-[#667085]">No publications found.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E4E7EC] rounded-lg divide-y divide-[#E4E7EC]">
          {publications.map((pub) => (
            <Link
              key={pub._id}
              to={`/publications/${pub._id}`}
              className="block p-4 hover:bg-[#F5F6F8] hover:pl-5 transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-[#1B2340]">{pub.title}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#F5F6F8] text-[#667085]">
                    {TYPE_LABELS[pub.publicationType] || pub.publicationType}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                      STATUS_STYLES[pub.status] || 'bg-[#F2F4F7] text-[#667085]'
                    }`}
                  >
                    {pub.status}
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#667085]">
                {pub.venueName || pub.publisher || '—'} &middot; {pub.department?.name || 'Unknown department'}
                {pub.authors?.length > 0 && <> &middot; {pub.authors.join(', ')}</>}
              </p>
            </Link>
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={pagination.totalPages} onPageChange={(p) => load(p)} />
    </div>
  )
}