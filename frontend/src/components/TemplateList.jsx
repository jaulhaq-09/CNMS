import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import templateService from '../services/templateService'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS } from '../config/permissions'
import TemplatePreview from './TemplatePreview'

const STATUS_STYLES = {
  DRAFT: 'bg-[#F2F4F7] text-[#667085]',
  ACTIVE: 'bg-[#ECFDF3] text-[#067647]',
  ARCHIVED: 'bg-[#F2F4F7] text-[#667085]',
}

const getTemplatePages = (template) => {
  const pages = template.structure?.pages
  if (Array.isArray(pages) && pages.length > 0) return pages
  return [
    {
      name: 'Page 1',
      blocks: Array.isArray(template.structure?.blocks) ? template.structure.blocks : [],
    },
  ]
}

export default function TemplateList({ onSelect, onEdit }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('all')
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [previewPageIndex, setPreviewPageIndex] = useState(0)

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

  const openPreview = (template) => {
    setPreviewTemplate(template)
    setPreviewPageIndex(0)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {user?.role !== 'SUPER_ADMIN' && (
          <h2 className="font-semibold text-lg text-[#1B2340]">Templates</h2>
        )}
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
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))' }}
        >
          {templates.map((template) => {
            const pages = getTemplatePages(template)
            const blockCount = pages.reduce((count, item) => count + (item.blocks?.length || 0), 0)

            return (
              <div
                key={template._id}
                className="bg-white border border-[#E4E7EC] rounded-xl p-5 flex flex-col shadow-sm hover:border-[#C9962C]/40 hover:shadow-md transition-all"
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

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-lg bg-[#F8F9FB] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-[#98A2B3]">Pages</p>
                  <p className="mt-0.5 text-xs font-semibold text-[#475467]">{pages.length}</p>
                </div>
                <div className="rounded-lg bg-[#F8F9FB] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-[#98A2B3]">Content blocks</p>
                  <p className="mt-0.5 text-xs font-semibold text-[#475467]">{blockCount}</p>
                </div>
                <div className="col-span-2 flex items-center justify-between text-xs text-[#667085]">
                  <span>{template.category || 'General'}</span>
                  <span>
                    Used {template.usageCount || 0} {template.usageCount === 1 ? 'time' : 'times'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-[#F2F4F7]">
                <button
                  type="button"
                  onClick={() => openPreview(template)}
                  className="px-3 py-1.5 rounded-md border border-[#E4E7EC] text-xs text-[#475467] hover:bg-[#F5F6F8]"
                >
                  Preview
                </button>
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
            )
          })}
        </div>
      )}

      {previewTemplate && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#101828]/50 p-4"
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-preview-title"
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-[#F8F9FB] p-4 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="template-preview-title" className="font-semibold text-[#1B2340]">
                  {previewTemplate.name}
                </h2>
                <p className="text-xs text-[#667085]">Template preview</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={previewPageIndex === 0}
                  onClick={() => setPreviewPageIndex((index) => Math.max(index - 1, 0))}
                  className="rounded-md border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-medium text-[#475467] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous page
                </button>
                <span className="text-xs text-[#667085]">
                  Page {previewPageIndex + 1} of {getTemplatePages(previewTemplate).length}
                </span>
                <button
                  type="button"
                  disabled={previewPageIndex >= getTemplatePages(previewTemplate).length - 1}
                  onClick={() =>
                    setPreviewPageIndex((index) =>
                      Math.min(index + 1, getTemplatePages(previewTemplate).length - 1)
                    )
                  }
                  className="rounded-md border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-medium text-[#475467] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next page
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="ml-1 rounded-md px-2 py-1 text-sm font-semibold text-[#667085] hover:bg-white hover:text-[#1B2340]"
                  aria-label="Close template preview"
                >
                  Close
                </button>
              </div>
            </div>
            {(() => {
              const pages = getTemplatePages(previewTemplate)
              const selectedPage = pages[previewPageIndex]
              return (
                <TemplatePreview
                  blocks={selectedPage?.blocks || []}
                  pageLabel={selectedPage?.name || `Page ${previewPageIndex + 1}`}
                />
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}