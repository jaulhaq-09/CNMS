import React, { useState } from 'react'
import TemplateBuilder from '../components/TemplateBuilder'
import TemplateList from '../components/TemplateList'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS } from '../config/permissions'

export default function TemplatePage() {
  const [view, setView] = useState('list')
  const [editingTemplateId, setEditingTemplateId] = useState(null)
  const { can } = usePermissions()

  const handleNewTemplate = () => {
    setEditingTemplateId(null)
    setView('builder')
  }

  const handleEditTemplate = (templateId) => {
    setEditingTemplateId(templateId)
    setView('builder')
  }

  const handleSave = () => {
    setView('list')
    setEditingTemplateId(null)
  }

  if (view === 'builder' && !editingTemplateId && !can(PERMISSIONS.TEMPLATES_CREATE)) {
    setView('list')
    return null
  }

  return (
    <div className="space-y-6">
      <nav className="flex gap-2">
        <button
          onClick={() => setView('list')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            view === 'list'
              ? 'bg-[#1B2340] text-white'
              : 'bg-white border border-[#E4E7EC] text-[#667085] hover:border-[#C9962C]/40'
          }`}
        >
          Templates
        </button>
        {can(PERMISSIONS.TEMPLATES_CREATE) && (
          <button
            onClick={handleNewTemplate}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              view === 'builder' && !editingTemplateId
                ? 'bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340]'
                : 'bg-white border border-[#E4E7EC] text-[#667085] hover:border-[#C9962C]/40'
            }`}
          >
            + New Template
          </button>
        )}
      </nav>

      {view === 'list' ? (
        <TemplateList onEdit={handleEditTemplate} onSelect={() => {}} />
      ) : (
        <TemplateBuilder templateId={editingTemplateId} onSave={handleSave} />
      )}
    </div>
  )
}