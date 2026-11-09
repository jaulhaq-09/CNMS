import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import templateService from '../services/templateService'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS } from '../config/permissions'

const STATUS_STYLES = {
  DRAFT: 'bg-[#F2F4F7] text-[#667085]',
  ACTIVE: 'bg-[#ECFDF3] text-[#067647]',
  ARCHIVED: 'bg-[#F2F4F7] text-[#667085]',
}

export default function TemplateList({ onSelect, onEdit }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('all')

  const { can } = usePermissions()
  const user = useSelector((state) => state.auth?.user)

  useEffect(() => {
    loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const filters = filter !== 'all' ? { status: filter } : {}
      const response = await templateService.getAll(filters, page, 10)
      setTemplates(response.data)
      setError(null)
    } catch (err) {
      setError('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleDuplicate = async (templateId) => {
    try {
      await templateService.duplicate(templateId)
      toast.success('Template duplicated')
      loadTemplates()
    } catch (err) {
      toast.error('Failed to duplicate template')
    }
  }

  const handleDelete = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return
    try {
      await templateService.delete(templateId)
      toast.success('Template deleted')
      loadTemplates()
    } catch (err) {
      toast.error('Failed to delete template')
    }
  }

  const handleSetMprTemplate = async (templateId) => {
    try {
      await templateService.setAsMprTemplate(templateId)
      toast.success('Set as the MPR template')
      loadTemplates()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to set MPR template')
    }
  }

  const handleUnsetMprTemplate = async (templateId) => {
    try {
      await templateService.unsetMprTemplate(templateId)
      toast.success('MPR template designation removed')
      loadTemplates()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove MPR designation')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-serif font-semibold text-lg text-[#1B2340]">Templates</h2>
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            setPage(1)
          }}
          className="border border-[#E4E7EC] rounded-md px-3 py-1.5 text-sm text-[#1B2340] bg-white focus:outline-none focus:border-[#C9962C]"
        >
          <option value="all">All Templates</option>
          <option value="DRAFT">Drafts</option>
          <option value="ACTIVE">Published</option>
        </select>
      </div>

      {loading && <p className="text-sm text-[#667085]">Loading templates...</p>}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}

      {!loading && templates.length === 0 ? (
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-5 text-sm text-[#667085]">
          No templates found.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template._id}
              className="bg-white border border-[#E4E7EC] rounded-lg p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-[#1B2340] text-sm leading-tight">
                  {template.name}
                </h3>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                    STATUS_STYLES[template.status] || 'bg-[#F2F4F7] text-[#667085]'
                  }`}
                >
                  {template.status}
                </span>
              </div>

              {template.isMprTemplate && (
                <span className="inline-flex items-center gap-1 self-start mb-2 px-2 py-0.5 rounded-full bg-[#C9962C] text-white text-[10px] font-semibold">
                  ★ MPR Template
                </span>
              )}

              {template.description && (
                <p className="text-xs text-[#667085] mb-3 line-clamp-2">{template.description}</p>
              )}

              <div className="text-xs text-[#98A2B3] space-y-0.5 mb-4">
                <p>Category: {template.category || 'General'}</p>
                <p>Used {template.usageCount || 0} times</p>
              </div>

              <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-[#F2F4F7]">
                {can(PERMISSIONS.TEMPLATES_EDIT) && (
                  <button
                    onClick={() => onEdit(template._id)}
                    className="px-3 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-medium hover:bg-[#242b52]"
                  >
                    Edit
                  </button>
                )}
                {can(PERMISSIONS.TEMPLATES_CREATE) && (
                  <button
                    onClick={() => handleDuplicate(template._id)}
                    className="px-3 py-1.5 rounded-md border border-[#E4E7EC] text-xs text-[#667085] hover:bg-[#F5F6F8]"
                  >
                    Duplicate
                  </button>
                )}
                {user?.role === 'SUPER_ADMIN' && !template.isMprTemplate && (
                  <button
                    onClick={() => handleSetMprTemplate(template._id)}
                    className="px-3 py-1.5 rounded-md border border-[#C9962C]/40 text-xs text-[#C9962C] font-medium hover:bg-[#C9962C]/10"
                  >
                    Set as MPR
                  </button>
                )}
                {user?.role === 'SUPER_ADMIN' && template.isMprTemplate && (
                  <button
                    onClick={() => handleUnsetMprTemplate(template._id)}
                    className="px-3 py-1.5 rounded-md border border-[#E4E7EC] text-xs text-[#667085] hover:bg-[#F5F6F8]"
                  >
                    Remove MPR
                  </button>
                )}
                {can(PERMISSIONS.TEMPLATES_DELETE) && (
                  <button
                    onClick={() => handleDelete(template._id)}
                    className="px-3 py-1.5 rounded-md border border-red-200 text-xs text-red-600 font-medium hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}