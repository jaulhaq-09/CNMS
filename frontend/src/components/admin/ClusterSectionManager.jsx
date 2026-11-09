import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ChevronRight, ChevronDown, Boxes, Plus, X, Pencil } from 'lucide-react'
import clusterService from '../../services/clusterService'
import sectionService from '../../services/sectionService'

// A small text box: Enter or clicking away saves, Esc cancels.
function RenameInput({ value, onSave, onCancel, className = '' }) {
  const [draft, setDraft] = useState(value)
  const done = React.useRef(false)

  const commit = () => {
    if (done.current) return
    done.current = true
    onSave(draft.trim())
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
        if (e.key === 'Escape') {
          done.current = true
          onCancel()
        }
      }}
      className={`border border-[#C9962C] rounded-md px-2 py-1 bg-white focus:outline-none ${className}`}
    />
  )
}

export default function ClusterSectionManager({ departmentId }) {
  const [clusters, setClusters] = useState([])
  const [loading, setLoading] = useState(false)
  const [newClusterName, setNewClusterName] = useState('')
  const [creatingCluster, setCreatingCluster] = useState(false)

  const [expandedClusterId, setExpandedClusterId] = useState(null)
  const [sectionsByCluster, setSectionsByCluster] = useState({})
  const [newSectionName, setNewSectionName] = useState('')
  const [creatingSection, setCreatingSection] = useState(false)
  const [renamingClusterId, setRenamingClusterId] = useState(null)
  const [renamingSectionId, setRenamingSectionId] = useState(null)

  useEffect(() => {
    loadClusters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId])

  const loadClusters = async () => {
    try {
      setLoading(true)
      const response = await clusterService.getByDepartment(departmentId)
      setClusters(response.data)
    } catch (err) {
      toast.error('Failed to load clusters')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCluster = async (e) => {
    e.preventDefault()
    const names = [
      ...new Set(
        newClusterName
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      ),
    ]
    if (names.length === 0) return
    try {
      setCreatingCluster(true)
      const failed = []
      let added = 0
      for (const name of names) {
        try {
          await clusterService.create({ name, department: departmentId })
          added += 1
        } catch (err) {
          failed.push(`${name} (${err.response?.data?.message || 'failed'})`)
        }
      }
      setNewClusterName('')
      if (added > 0) toast.success(added === 1 ? 'Cluster added' : `${added} clusters added`)
      if (failed.length > 0) toast.error(`Not added: ${failed.join(', ')}`)
      loadClusters()
    } finally {
      setCreatingCluster(false)
    }
  }

  const handleDeleteCluster = async (clusterId) => {
    try {
      await clusterService.delete(clusterId)
      toast.success('Cluster removed')
      if (expandedClusterId === clusterId) setExpandedClusterId(null)
      loadClusters()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove cluster')
    }
  }

  const handleRenameCluster = async (cluster, name) => {
    setRenamingClusterId(null)
    if (!name || name === cluster.name) return
    try {
      const res = await clusterService.update(cluster._id, { name })
      toast.success(res.message || 'Cluster renamed')
      loadClusters()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rename cluster')
    }
  }

  const handleRenameSection = async (section, clusterId, name) => {
    setRenamingSectionId(null)
    if (!name || name === section.name) return
    try {
      const res = await sectionService.update(section._id, { name })
      toast.success(res.message || 'Section renamed')
      const response = await sectionService.getByCluster(clusterId)
      setSectionsByCluster((prev) => ({ ...prev, [clusterId]: response.data }))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rename section')
    }
  }

  const toggleCluster = async (clusterId) => {
    if (expandedClusterId === clusterId) {
      setExpandedClusterId(null)
      return
    }
    setExpandedClusterId(clusterId)
    if (!sectionsByCluster[clusterId]) {
      try {
        const response = await sectionService.getByCluster(clusterId)
        setSectionsByCluster((prev) => ({ ...prev, [clusterId]: response.data }))
      } catch (err) {
        toast.error('Failed to load sections')
      }
    }
  }

  const handleCreateSection = async (e, clusterId) => {
    e.preventDefault()
    // "CSE-M, CSE-N" becomes two sections; repeated names are ignored.
    const names = [
      ...new Set(
        newSectionName
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      ),
    ]
    if (names.length === 0) return
    try {
      setCreatingSection(true)
      const failed = []
      let added = 0
      for (const name of names) {
        try {
          await sectionService.create({ name, cluster: clusterId })
          added += 1
        } catch (err) {
          failed.push(`${name} (${err.response?.data?.message || 'failed'})`)
        }
      }
      setNewSectionName('')
      if (added > 0) toast.success(added === 1 ? 'Section added' : `${added} sections added`)
      if (failed.length > 0) toast.error(`Not added: ${failed.join(', ')}`)
      const response = await sectionService.getByCluster(clusterId)
      setSectionsByCluster((prev) => ({ ...prev, [clusterId]: response.data }))
    } finally {
      setCreatingSection(false)
    }
  }

  const handleDeleteSection = async (sectionId, clusterId) => {
    try {
      await sectionService.delete(sectionId)
      toast.success('Section removed')
      const response = await sectionService.getByCluster(clusterId)
      setSectionsByCluster((prev) => ({ ...prev, [clusterId]: response.data }))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove section')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400 font-semibold">
        Clusters &amp; Sections
      </p>

      {loading ? (
        <div className="h-3.5 w-1/3 bg-gray-200 rounded animate-pulse" />
      ) : clusters.length === 0 ? (
        <p className="text-sm text-gray-400">No clusters yet — add one below.</p>
      ) : (
        <div className="space-y-2">
          {clusters.map((cluster) => (
            <div key={cluster._id} className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5">
                {renamingClusterId === cluster._id ? (
                  <RenameInput
                    value={cluster.name}
                    onSave={(name) => handleRenameCluster(cluster, name)}
                    onCancel={() => setRenamingClusterId(null)}
                    className="text-sm font-medium text-[#1B2340] w-64"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCluster(cluster._id)}
                      className="flex items-center gap-2 text-sm font-medium text-[#1B2340] hover:text-[#C9962C] transition-colors"
                    >
                      {expandedClusterId === cluster._id ? (
                        <ChevronDown size={14} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-400" />
                      )}
                      <Boxes size={14} className="text-[#C9962C]" />
                      {cluster.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingClusterId(cluster._id)}
                      className="text-gray-300 hover:text-[#C9962C] transition-colors"
                      title="Rename cluster"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteCluster(cluster._id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Remove cluster"
                >
                  <X size={14} />
                </button>
              </div>

              {expandedClusterId === cluster._id && (
                <div className="border-t border-gray-100 px-3 py-3 bg-gray-50/50 space-y-2">
                  {(sectionsByCluster[cluster._id] || []).length === 0 ? (
                    <p className="text-xs text-gray-400">No sections yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sectionsByCluster[cluster._id].map((section) => (
                        <span
                          key={section._id}
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-white border border-gray-200 text-xs text-[#334155]"
                        >
                          {renamingSectionId === section._id ? (
                            <RenameInput
                              value={section.name}
                              onSave={(name) => handleRenameSection(section, cluster._id, name)}
                              onCancel={() => setRenamingSectionId(null)}
                              className="text-xs w-32"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setRenamingSectionId(section._id)}
                              title="Click to rename"
                              className="hover:text-[#C9962C] transition-colors"
                            >
                              {section.name}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteSection(section._id, cluster._id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <form onSubmit={(e) => handleCreateSection(e, cluster._id)} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="New section name (or several, separated by commas)"
                      className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#C9962C]"
                    />
                    <button
                      type="submit"
                      disabled={creatingSection}
                      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md bg-[#1B2340] text-white hover:bg-[#1B2340]/90 disabled:opacity-60"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleCreateCluster} className="flex gap-2 pt-1">
        <input
          type="text"
          value={newClusterName}
          onChange={(e) => setNewClusterName(e.target.value)}
          placeholder="New cluster name"
          className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#C9962C]"
        />
        <button
          type="submit"
          disabled={creatingCluster}
          className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] hover:brightness-105 disabled:opacity-60"
        >
          <Plus size={13} /> Add Cluster
        </button>
      </form>
    </div>
  )
}