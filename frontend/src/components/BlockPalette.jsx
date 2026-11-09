import React from 'react'

const AVAILABLE_BLOCKS = [
  {
    id: 'header',
    name: 'Header',
    badge: 'H',
    type: 'header',
    config: {
      title: 'Newsletter Title',
      subtitle: 'Your subtitle here',
      backgroundColor: '#1B2340',
      textColor: '#ffffff',
    },
  },
  {
    id: 'hero',
    name: 'Hero Image',
    badge: 'I',
    type: 'hero',
    config: {
      imageUrl: 'https://via.placeholder.com/600x300',
      altText: 'Hero image',
      height: '300px',
    },
  },
  {
    id: 'gallery',
    name: 'Gallery',
    badge: 'P',
    type: 'gallery',
    config: {
      images: [],
      columns: 3,
    },
  },
  {
    id: 'text',
    name: 'Text',
    badge: 'T',
    type: 'text',
    config: {
      content: 'Add your text content here',
      fontSize: '16px',
      textColor: '#333333',
    },
  },
  {
    id: 'events-grid',
    name: 'Events Grid',
    badge: 'G',
    type: 'events-grid',
    config: {
      columns: 2,
      eventsPerPage: 4,
      showDate: true,
      showLocation: true,
    },
  },
  {
    id: 'divider',
    name: 'Divider',
    badge: '—',
    type: 'divider',
    config: {
      color: '#cccccc',
      height: '2px',
      margin: '20px',
    },
  },
  {
    id: 'button',
    name: 'Button',
    badge: 'B',
    type: 'button',
    config: {
      text: 'Click Here',
      url: '#',
      backgroundColor: '#C9962C',
      textColor: '#1B2340',
    },
  },
  {
    id: 'footer',
    name: 'Footer',
    badge: 'F',
    type: 'footer',
    config: {
      text: '© 2026 College Newsletter',
      links: [
        { text: 'Website', url: '#' },
        { text: 'Contact', url: '#' },
      ],
    },
  },
]

export default function BlockPalette({ onAddBlock }) {
  const handleDragStart = (e, block) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('block', JSON.stringify(block))
  }

  return (
    <div className="bg-white border border-[#E4E7EC] rounded-lg p-4">
      <p className="text-[11px] uppercase tracking-[0.15em] text-[#667085] font-semibold mb-3">
        Blocks
      </p>
      <div className="space-y-1.5">
        {AVAILABLE_BLOCKS.map((block) => (
          <div
            key={block.id}
            draggable
            onDragStart={(e) => handleDragStart(e, block)}
            onClick={() => onAddBlock(block)}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md border border-transparent hover:border-[#E4E7EC] hover:bg-[#F5F6F8] cursor-grab active:cursor-grabbing transition-colors"
          >
            <span className="w-7 h-7 rounded-md bg-[#1B2340] text-white text-xs font-serif font-semibold flex items-center justify-center shrink-0">
              {block.badge}
            </span>
            <span className="text-sm text-[#1B2340]">{block.name}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#98A2B3] mt-3">Drag onto the canvas, or click to add.</p>
    </div>
  )
}