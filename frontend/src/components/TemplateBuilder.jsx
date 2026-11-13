import React, { useState, useEffect } from 'react'
import BlockPalette from './BlockPalette'
import TemplateEditor from './TemplateEditor'
import TemplatePreview from './TemplatePreview'
import templateService from '../services/templateService'
import { BMS_LOGO_DATA_URL, BMS_CAMPUS_PHOTO_DATA_URL } from '../assets/coverAssets'
import { FOUNDER_1_DATA_URL, FOUNDER_2_DATA_URL, PRINCIPAL_DATA_URL } from '../assets/mastheadAssets'
import { BACKCOVER_PHOTO_DATA_URL, BACKCOVER_QR_DATA_URL } from '../assets/backcoverAssets'

// The first two pages of every new newsletter are BMSIT&M's fixed
// cover + masthead pages — locked content that must stay identical
// across every template, so coordinators can't edit or remove them.
function makeFrontFixedPages() {
  return [
    {
      id: 'fixed-cover',
      name: 'Cover',
      fixed: true,
      contentEditable: true,
      blocks: [
        {
          id: 'fixed-cover-page',
          type: 'cover-page',
          config: {
            logoUrl: BMS_LOGO_DATA_URL,
            photoUrl: BMS_CAMPUS_PHOTO_DATA_URL,
            orgShort: 'BMS',
            orgFull: 'INSTITUTE OF TECHNOLOGY AND MANAGEMENT',
            accreditation: 'An Autonomous Institute Under VTU, Accredited by NBA and NAAC',
            location: 'Yelahanka, Bengaluru-560119.',
            volume: '12,',
            issue: '01',
            issueLabel: 'Monthly Newsletter / January - 2026',
            locked: true,
          },
        },
      ],
    },
    {
      id: 'fixed-masthead',
      name: 'About',
      fixed: true,
      contentEditable: true,
      blocks: [
        {
          id: 'fixed-masthead-page',
          type: 'masthead-page',
          config: {
            logoUrl: BMS_LOGO_DATA_URL,
            orgShort: 'BMS',
            orgFull: 'INSTITUTE OF TECHNOLOGY AND MANAGEMENT',
            founder1: {
              photoUrl: FOUNDER_1_DATA_URL,
              name: 'LATE SRI. B. M. SREENIVASAIAH',
              role: 'Founder',
              org: 'BMS College of Engineering',
            },
            founder2: {
              photoUrl: FOUNDER_2_DATA_URL,
              name: 'LATE SRI. B. S. NARAYAN',
              role: 'Founder',
              org: 'BMS Educational Trust',
            },
            vision:
              'To emerge as one of the finest technical institutions of higher learning, to develop engineering professionals who are technically competent, ethical and environment friendly for betterment of the society.',
            mission:
              'Accomplish stimulating learning environment through high quality academic instruction, innovation and industry-institute interface.',
            phone: '080 - 2952 1171 / 6873 0444',
            website: 'https://bmsit.ac.in/',
            email: 'principal@bmsit.in',
            twitter: 'https://twitter.com/bmsitm1',
            facebook: 'https://www.facebook.com/bmsit',
            linkedin: 'https://www.linkedin.com/school/bms-institute-of-technology-and-management/',
            youtube: 'https://www.youtube.com/channel/UCZLUwjJYZZvXvfPketkZZMQ',
            principalPhotoUrl: PRINCIPAL_DATA_URL,
            presentedByName: 'Dr. Sanjay H A',
            presentedByRole: 'Principal, BMSIT&M',
            contents: [
              { label: 'Events Conducted', page: 1 },
              { label: 'Faculty as Resource Person', page: 1 },
              { label: 'Faculty Achievements', page: 1 },
              { label: 'Student Achievements', page: 3 },
              { label: 'Students Workshops Conducted/ Events Organized', page: 5 },
              { label: 'Alumni Interaction', page: 7 },
              { label: 'Faculty FDP Organized', page: 8 },
              { label: 'International Journal /Conference/Book Chapter/Book Publications', page: 9 },
              { label: 'Patents Published/Applied', page: 10 },
              { label: 'Sports and NCC Events', page: 10 },
            ],
            editorialBoard: [
              "Dr. Ambika R, Dean (Students' Welfare)",
              'Dr. Surekha R Gondkar, Assoc. Prof., Dept. of ECE',
              'Dr. Shanthi D L, Assoc. Prof., Dept. of CSE',
              'Ms. Vishishta Shenoy, 1BY22AI123',
              'Ms. Varsha B, 1BY23CS260',
              'Ms. Arpitha Pandit, 1BY23CV010',
              'Mr. Harsh Kumar, 1BY23CB021',
              'Mr. K Sujith, 1BY23EC053',
              'Mr. Nithin Shetty L, 1BY24EE402',
              'Ms. Jiya Kulkarni, 1BY23ET023',
              'Ms. Kalpitha Naik, 1BY23IS259',
              'Ms. Bhoomika K B, 1BY22ME008',
              'Ms. Krishna Priya R, 1BY24BA037',
              'Mr. Yogin N C, 1BY23MC110',
            ],
            locked: true,
          },
        },
      ],
    },
  ]
}

// The last page of every new newsletter is BMSIT&M's fixed back cover —
// always pinned as the final page regardless of how many content pages
// get added or removed in between (see handleAddPage's insert-before-back
// logic below).
function makeBackFixedPage() {
  return {
    id: 'fixed-backcover',
    name: 'Back Cover',
    fixed: true,
    blocks: [
      {
        id: 'fixed-backcover-page',
        type: 'backcover-page',
        config: {
          photoUrl: BACKCOVER_PHOTO_DATA_URL,
          qrUrl: BACKCOVER_QR_DATA_URL,
          logoUrl: BMS_LOGO_DATA_URL,
          orgShort: 'BMS',
          orgFull: 'INSTITUTE OF TECHNOLOGY AND MANAGEMENT',
          address: 'Doddaballapur Main Road, Avalahalli, Yelahanka, Bengaluru - 560119.',
          emailLine: 'Ph: 080 - 2952 1171 / 6873 0444  |  email: principal@bmsit.in  |  www.bmsit.in',
          socialLine: '@bmsit_m (Twitter)   bmsit_m (Instagram)   BMS Institute of Technology (Facebook/YouTube)',
          locked: true,
        },
      },
    ],
  }
}

function makePage(name) {
  return { id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, blocks: [] }
}

// Templates saved before multi-page support stored blocks directly at
// structure.blocks. Wrap that as a single page so old templates still
// open correctly instead of appearing empty.
function normalizeStructure(structure) {
  if (structure?.pages?.length) return structure
  return { pages: [{ id: 'page-1', name: 'Page 1', blocks: structure?.blocks || [] }] }
}

export default function TemplateBuilder({ templateId = null, onSave = null }) {
  const [template, setTemplate] = useState({
    name: '',
    description: '',
    category: 'General',
    structure: { pages: [...makeFrontFixedPages(), makePage('Page 1'), makeBackFixedPage()] },
  })
  const [activePageIndex, setActivePageIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (templateId) {
      loadTemplate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  const loadTemplate = async () => {
    try {
      setLoading(true)
      const response = await templateService.getById(templateId)
      setTemplate({ ...response.data, structure: normalizeStructure(response.data.structure) })
      setActivePageIndex(0)
      setError(null)
    } catch (err) {
      setError('Failed to load template')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      if (!template.name.trim()) {
        setError('Template name is required')
        return
      }

      setLoading(true)
      setError(null)

      let response
      if (templateId) {
        response = await templateService.update(templateId, template)
        setSuccess('Template updated successfully!')
      } else {
        response = await templateService.create(template)
        setSuccess('Template created successfully!')
      }

      if (onSave) onSave(response.data)

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save template')
    } finally {
      setLoading(false)
    }
  }

  const pages = template.structure?.pages || []
  const activePage = pages[activePageIndex] || pages[0]

  // Single place pages get written back to `template` — every page
  // mutation (add/remove/rename/block-change) goes through this, same
  // "one source of truth" pattern used to fix the block-editing bug.
  const updatePages = (newPages) => {
    setTemplate({ ...template, structure: { ...template.structure, pages: newPages } })
  }

  const handleAddPage = () => {
    const backIndex = pages.findIndex((p) => p.id === 'fixed-backcover')
    const insertAt = backIndex === -1 ? pages.length : backIndex
    const newPage = makePage(`Page ${pages.length + 1}`)
    const newPages = [...pages.slice(0, insertAt), newPage, ...pages.slice(insertAt)]
    updatePages(newPages)
    setActivePageIndex(insertAt)
  }

  const handleRemovePage = (index) => {
    if (pages.length <= 1) return
    if (pages[index]?.fixed) return
    const newPages = pages.filter((_, i) => i !== index)
    updatePages(newPages)
    setActivePageIndex((prev) => {
      if (index < prev) return prev - 1
      if (index === prev) return Math.min(prev, newPages.length - 1)
      return prev
    })
  }

  const handleRenamePage = (index, name) => {
    if (pages[index]?.fixed) return
    updatePages(pages.map((p, i) => (i === index ? { ...p, name } : p)))
  }

  const handleAddBlock = (block) => {
    if (activePage?.fixed) return
    const newBlock = { ...block, id: `${block.type}-${Date.now()}` }
    updatePages(
      pages.map((p, i) => (i === activePageIndex ? { ...p, blocks: [...p.blocks, newBlock] } : p))
    )
  }

  const handleChangeBlocks = (newBlocks) => {
    if (activePage?.fixed && !activePage?.contentEditable) return
    updatePages(pages.map((p, i) => (i === activePageIndex ? { ...p, blocks: newBlocks } : p)))
  }

  if (loading && templateId) {
    return <p className="text-sm text-[#667085]">Loading template...</p>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <span className="font-serif font-semibold text-[#1B2340] shrink-0">Builder</span>
          <input
            type="text"
            placeholder="Template name"
            value={template.name}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            className="flex-1 px-3 py-2 rounded-md border border-[#E4E7EC] text-sm focus:outline-none focus:border-[#C9962C]"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={template.category}
            onChange={(e) => setTemplate({ ...template, category: e.target.value })}
            className="px-3 py-2 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
          >
            <option>General</option>
            <option>Weekly</option>
            <option>Monthly</option>
            <option>Special Event</option>
            <option>Announcement</option>
          </select>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2 rounded-md bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#1B2340] text-sm font-semibold hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-md bg-[#ECFDF3] text-[#067647] text-sm border border-[#067647]/20">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 items-start lg:grid-cols-[200px_minmax(0,1fr)] 2xl:grid-cols-[200px_minmax(0,1fr)_320px]">
        <BlockPalette onAddBlock={handleAddBlock} />

        <TemplateEditor
          pages={pages}
          activePageIndex={activePageIndex}
          onSelectPage={setActivePageIndex}
          onAddPage={handleAddPage}
          onRemovePage={handleRemovePage}
          onRenamePage={handleRenamePage}
          blocks={activePage?.blocks || []}
          onChangeBlocks={handleChangeBlocks}
          readOnly={!!activePage?.fixed}
          contentEditable={!!activePage?.contentEditable}
        />

        <div className="lg:col-span-2 2xl:col-span-1">
          <TemplatePreview blocks={activePage?.blocks || []} pageLabel={activePage?.name} />
        </div>
      </div>
    </div>
  )
}