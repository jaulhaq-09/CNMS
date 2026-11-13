import React, { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import ExportCenter from '../components/ExportCenter'
import ReportBuilder from '../components/ReportBuilder'
import ReportScheduler from '../components/ReportScheduler'
import ReportsList from '../components/ReportsList'
import CoordinatorClusterReport from '../components/report/CoordinatorClusterReport'
import AdminConsolidationCenter from '../components/report/AdminConsolidationCenter'
import reportService from '../services/reportService'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS } from '../config/permissions'
import PageHeader from '../components/common/PageHeader'

export default function ReportPage() {
  const { can } = usePermissions()
  const canExport = can(PERMISSIONS.EXPORT_VIEW)
  const currentUser = useSelector((state) => state.auth?.user)

  const isAdmin = currentUser?.role
    ? currentUser.role === 'SUPER_ADMIN'
    : (currentUser?.roles || []).includes('SUPER_ADMIN')
  const isCoordinator = currentUser?.role
    ? currentUser.role === 'COORDINATOR'
    : (currentUser?.roles || []).includes('COORDINATOR')

  const initialView = isAdmin
    ? 'consolidation'
    : isCoordinator
    ? 'cluster-report'
    : canExport
    ? 'export'
    : 'builder'

  const [reports, setReports] = useState([])
  const [view, setView] = useState(initialView)
  const [loading, setLoading] = useState(false)
  const [reportsError, setReportsError] = useState('')

  const loadReports = useCallback(async () => {
    try {
      setLoading(true)
      setReportsError('')
      const response = await reportService.getAll(1, 20)
      setReports(response.data)
    } catch (error) {
      console.error('Failed to load reports:', error)
      setReportsError(error.response?.data?.message || 'Could not load your reports.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (view === 'list' || view === 'scheduler') loadReports()
  }, [view, loadReports])

  const tabs = [
    ...(isCoordinator ? [{ id: 'cluster-report', label: 'Cluster Monthly Report' }] : []),
    ...(isAdmin ? [{ id: 'consolidation', label: 'Consolidation Center' }] : []),
    ...(canExport ? [{ id: 'export', label: 'Quick Export' }] : []),
    { id: 'builder', label: 'Build Report' },
    { id: 'list', label: `My Reports${reports.length > 0 ? ` (${reports.length})` : ''}` },
    { id: 'scheduler', label: 'Schedule Reports' },
  ]

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <PageHeader
          title="Reports"
          description="Build, review, export, and schedule reports for your role and department."
        />
      )}
      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              view === tab.id
                ? 'bg-[#1B2340] text-white shadow-sm'
                : 'bg-white border border-[#E4E7EC] text-[#667085] hover:border-[#C9962C]/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {reportsError && (view === 'list' || view === 'scheduler') && (
        <div role="alert" className="rounded-lg border border-[#FECDCA] bg-[#FEF3F2] px-4 py-3 text-sm text-[#B42318]">
          {reportsError}
        </div>
      )}

      {view === 'cluster-report' && <CoordinatorClusterReport />}
      {view === 'consolidation' && isAdmin && <AdminConsolidationCenter />}
      {view === 'export' && canExport && <ExportCenter />}
      {view === 'builder' && (
        <ReportBuilder
          onSave={() => {
            loadReports()
            setView('list')
          }}
        />
      )}
      {view === 'list' && (
        <ReportsList reports={reports} loading={loading} onChanged={loadReports} />
      )}
      {view === 'scheduler' && <ReportScheduler reports={reports} onChanged={loadReports} />}
    </div>
  )
}
