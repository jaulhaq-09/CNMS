import React, { useState, useEffect } from 'react'
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

export default function ReportPage() {
  const { can } = usePermissions()
  const canExport = can(PERMISSIONS.EXPORT_VIEW)
  const currentUser = useSelector((state) => state.auth?.user)

  const isCoordinator =
    currentUser?.role === 'COORDINATOR' || (currentUser?.roles || []).includes('COORDINATOR')
  const isAdmin =
    currentUser?.role === 'SUPER_ADMIN' || (currentUser?.roles || []).includes('SUPER_ADMIN')

  const initialView = isCoordinator
    ? 'cluster-report'
    : isAdmin
    ? 'consolidation'
    : canExport
    ? 'export'
    : 'builder'

  const [reports, setReports] = useState([])
  const [view, setView] = useState(initialView)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    try {
      setLoading(true)
      const response = await reportService.getAll(1, 20)
      setReports(response.data)
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    ...(isCoordinator || isAdmin
      ? [{ id: 'cluster-report', label: 'Cluster Monthly Report' }]
      : []),
    ...(isAdmin ? [{ id: 'consolidation', label: 'Consolidation Center' }] : []),
    ...(canExport ? [{ id: 'export', label: 'Quick Export' }] : []),
    { id: 'builder', label: 'Build Report' },
    { id: 'list', label: `My Reports${reports.length > 0 ? ` (${reports.length})` : ''}` },
    { id: 'scheduler', label: 'Schedule Reports' },
  ]

  return (
    <div className="space-y-6">
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
