import React, { useState } from 'react'
import {
  HeaderBlock,
  TextBlock,
  HeroBlock,
  EventsGridBlock,
  DividerBlock,
  ButtonBlock,
  FooterBlock,
  GalleryBlock,
  CoverPageBlock,
  MastheadPageBlock,
  BackCoverPageBlock,
} from './BlockPaletteBlocks'

const BLOCK_COMPONENTS = {
  header: HeaderBlock,
  text: TextBlock,
  hero: HeroBlock,
  'events-grid': EventsGridBlock,
  divider: DividerBlock,
  button: ButtonBlock,
  footer: FooterBlock,
  gallery: GalleryBlock,
  'cover-page': CoverPageBlock,
  'masthead-page': MastheadPageBlock,
  'backcover-page': BackCoverPageBlock,
}

function PageTabs({ pages, activePageIndex, onSelectPage, onAddPage, onRemovePage, onRenamePage }) {
  const [renamingIndex, setRenamingIndex] = useState(null)
  const [draftName, setDraftName] = useState('')

  const commitRename = (index) => {
    const trimmed = draftName.trim()
    if (trimmed) onRenamePage(index, trimmed)
    setRenamingIndex(null)
  }

  return (
    <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
      {pages.map((page, index) => {
        const active = index === activePageIndex
        const isRenaming = renamingIndex === index
        return (
          <div
            key={page.id}
            className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-md border text-sm shrink-0 cursor-pointer transition-colors ${active
              ? 'border-[#C9962C] bg-[#FFFBF2] text-[#1B2340]'
              : 'border-[#E4E7EC] bg-white text-[#667085] hover:border-[#C9962C]/40'
              }`}
            onClick={() => !isRenaming && onSelectPage(index)}
            onDoubleClick={() => {
              if (page.fixed) return
              setRenamingIndex(index)
              setDraftName(page.name)
            }}
          >
            {isRenaming ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => commitRename(index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(index)
                  if (e.key === 'Escape') setRenamingIndex(null)
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-24 bg-transparent border-none outline-none text-sm"
              />
            ) : (
              <span className="whitespace-nowrap">
                {page.fixed && <span title="Locked page">🔒 </span>}
                {page.name}
              </span>
            )}

            {pages.length > 1 && !isRenaming && !page.fixed && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemovePage(index)
                }}
                className="w-5 h-5 rounded flex items-center justify-center text-[#98A2B3] opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all text-xs"
                title="Delete page"
              >
                ✕
              </button>
            )}
          </div>
        )
      })}

      <button
        onClick={onAddPage}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-dashed border-[#C9962C]/50 text-sm text-[#C9962C] hover:bg-[#FFFBF2] hover:border-[#C9962C] transition-colors shrink-0"
      >
        <span className="text-base leading-none">+</span> Add page
      </button>
    </div>
  )
}

export default function TemplateEditor({
  pages,
  activePageIndex,
  onSelectPage,
  onAddPage,
  onRemovePage,
  onRenamePage,
  blocks,
  onChangeBlocks,
  readOnly = false,
  contentEditable = false,
}) {
  const [dragOver, setDragOver] = useState(false)

  const handleAddBlock = (block) => {
    if (readOnly) return
    const newBlock = { ...block, id: `${block.type}-${Date.now()}` }
    onChangeBlocks([...blocks, newBlock])
  }

  const handleRemoveBlock = (blockId) => {
    if (readOnly) return
    onChangeBlocks(blocks.filter((b) => b.id !== blockId))
  }

  const handleUpdateBlock = (blockId, updates) => {
    if (readOnly && !contentEditable) return
    onChangeBlocks(blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)))
  }

  const handleDragOver = (e) => {
    if (readOnly) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e) => {
    if (readOnly) return
    e.preventDefault()
    setDragOver(false)
    try {
      const blockData = JSON.parse(e.dataTransfer.getData('block'))
      handleAddBlock(blockData)
    } catch (error) {
      console.error('Drop error:', error)
    }
  }

  return (
    <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 min-h-[400px]">
      <p className="text-[11px] uppercase tracking-[0.15em] text-[#667085] font-semibold mb-1">
        Canvas
      </p>
      <p className="text-xs text-[#98A2B3] mb-4">
        {readOnly && contentEditable
          ? '🔒 Layout is locked, but double-click any line to edit its text.'
          : readOnly
          ? '🔒 This page is locked and cannot be edited.'
          : 'Drag blocks from the palette, or click one to add it here. Double-click a page tab to rename it.'}
      </p>

      <PageTabs
        pages={pages}
        activePageIndex={activePageIndex}
        onSelectPage={onSelectPage}
        onAddPage={onAddPage}
        onRemovePage={onRemovePage}
        onRenamePage={onRenamePage}
      />

      <div className="bg-[#EDEFF2] rounded-lg p-6 flex justify-center">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative bg-white border overflow-y-auto transition-colors ${dragOver ? 'border-[#C9962C] ring-2 ring-[#C9962C]/30' : 'border-[#E4E7EC]'
            }`}
          style={{
            width: '100%',
            maxWidth: '680px',
            aspectRatio: '8.5 / 11',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 8px 24px rgba(16,24,40,0.10)',
          }}
        >
          {/* subtle paper-grain texture */}
          <div
            className="absolute inset-0 opacity-[0.035] pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />

          <div
            className="relative"
            style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: '100%',
              pointerEvents: readOnly && !contentEditable ? 'none' : 'auto',
            }}
          >
            {blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-24 px-6 flex-1">
                <p className="text-sm text-[#667085] mb-1">No blocks yet</p>
                <p className="text-xs text-[#98A2B3]">Drag a block here to get started</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-transparent" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {blocks
                    .filter((block) => block.type !== 'footer')
                    .map((block) => {
                      const BlockComponent = BLOCK_COMPONENTS[block.type]
                      const isFullPageBlock =
                        block.type === 'cover-page' || block.type === 'masthead-page' || block.type === 'backcover-page'
                      return (
                        <div
                          key={block.id}
                          style={isFullPageBlock ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : undefined}
                        >
                          {BlockComponent ? (
                            <BlockComponent
                              block={block}
                              onUpdate={handleUpdateBlock}
                              onRemove={() => handleRemoveBlock(block.id)}
                            />
                          ) : (
                            <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm">
                              Unknown block type: {block.type}
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>

                {/* Footer blocks always render last and get pushed to the
                    bottom edge of the page via marginTop: 'auto' — a real
                    page footer sits at the bottom of the sheet regardless
                    of how much content is above it, not wherever it
                    happened to be added in the block list. */}
                {blocks
                  .filter((block) => block.type === 'footer')
                  .map((block) => {
                    const BlockComponent = BLOCK_COMPONENTS[block.type]
                    return (
                      <div key={block.id} style={{ marginTop: 'auto' }}>
                        <BlockComponent
                          block={block}
                          onUpdate={handleUpdateBlock}
                          onRemove={() => handleRemoveBlock(block.id)}
                        />
                      </div>
                    )
                  })}
              </>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-[#98A2B3] mt-3">
        Page full? <button onClick={onAddPage} className="text-[#C9962C] font-medium hover:underline">Add another page</button>
      </p>
    </div>
  )
}