import React from 'react'
import { useEventsData } from '../hooks/useEventsData'

// Wrapper used by every block below — Tailwind chrome (border, hover-reveal
// remove button) around whatever the block itself renders. The block's
// inner content deliberately keeps inline styles driven by block.config,
// since that represents the actual newsletter's visual design (which can
// have any color scheme the coordinator picks) — not the app's own theme.
function BlockShell({ onRemove, locked, children }) {
  return (
    <div
      className={`group relative overflow-hidden transition-colors ${locked ? '' : 'border border-[#E4E7EC] rounded-lg hover:border-[#C9962C]/40'
        }`}
    >
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-md bg-white/90 backdrop-blur-sm border border-[#E4E7EC] text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all flex items-center justify-center text-sm"
        title="Remove block"
      >
        ✕
      </button>
      {children}
    </div>
  )
}

// Shared style for text inputs that live directly inside the rendered
// block (title, subtitle, button text, etc). Transparent background and no
// border by default so it reads as real content, not a form field — a
// dashed outline only appears on focus/hover so it's still discoverable
// as editable.
function inlineFieldStyle(extra = {}) {
  return {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    ...extra,
  }
}

function updateConfig(block, onUpdate, patch) {
  onUpdate(block.id, { config: { ...block.config, ...patch } })
}

const PADDING_OPTIONS = [
  { value: '6px', label: 'Compact' },
  { value: '14px', label: 'Normal' },
  { value: '28px', label: 'Spacious' },
]

export function HeaderBlock({ block, onUpdate, onRemove }) {
  const isLocked = !!block.config.locked
  const headerWidth = block.config.headerWidth || '100%'
  const headerAlign = block.config.headerAlign || 'center'
  const padding = block.config.padding || '18px'

  return (
    <BlockShell onRemove={onRemove} locked={isLocked}>
      <div
        className="relative"
        onDoubleClick={() => isLocked && updateConfig(block, onUpdate, { locked: false })}
      >
        <div
          style={{
            display: 'flex',
            justifyContent:
              headerAlign === 'left' ? 'flex-start' : headerAlign === 'right' ? 'flex-end' : 'center',
          }}
        >
          <div style={{ width: headerWidth, backgroundColor: block.config.backgroundColor }}>
            <div style={{ color: block.config.textColor, textAlign: 'center', padding }}>
              <input
                type="text"
                spellCheck={false}
                autoCorrect="off"
                value={block.config.title}
                onChange={(e) => updateConfig(block, onUpdate, { title: e.target.value })}
                placeholder="Newsletter title"
                readOnly={isLocked}
                className={`rounded px-1 transition-shadow ${isLocked ? '' : 'hover:ring-1 hover:ring-white/30 focus:ring-1 focus:ring-white/60'
                  }`}
                style={inlineFieldStyle({
                  color: 'inherit',
                  fontSize: '17px',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  textAlign: 'center',
                  marginBottom: '2px',
                  cursor: isLocked ? 'default' : 'text',
                })}
              />
              <input
                type="text"
                spellCheck={false}
                autoCorrect="off"
                value={block.config.subtitle}
                onChange={(e) => updateConfig(block, onUpdate, { subtitle: e.target.value })}
                placeholder="Subtitle"
                readOnly={isLocked}
                className={`rounded px-1 transition-shadow ${isLocked ? '' : 'hover:ring-1 hover:ring-white/30 focus:ring-1 focus:ring-white/60'
                  }`}
                style={inlineFieldStyle({
                  color: 'inherit',
                  fontSize: '11px',
                  opacity: 0.8,
                  textAlign: 'center',
                  cursor: isLocked ? 'default' : 'text',
                })}
              />
            </div>
          </div>
        </div>
      </div>

      {!isLocked && (
        <div className="px-4 py-2.5 border-t border-[#E4E7EC] bg-[#F5F6F8] space-y-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-[#667085]">
              Background
              <input
                type="color"
                value={block.config.backgroundColor}
                onChange={(e) => updateConfig(block, onUpdate, { backgroundColor: e.target.value })}
                className="w-6 h-6 rounded border border-[#E4E7EC] cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#667085]">
              Text
              <input
                type="color"
                value={block.config.textColor}
                onChange={(e) => updateConfig(block, onUpdate, { textColor: e.target.value })}
                className="w-6 h-6 rounded border border-[#E4E7EC] cursor-pointer"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <label className="block text-xs text-[#667085] mb-1.5">Width</label>
              <div className="flex gap-1">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateConfig(block, onUpdate, { headerWidth: opt.value })}
                    className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${headerWidth === opt.value
                      ? 'border-[#C9962C] bg-[#FFFBF2] text-[#1B2340]'
                      : 'border-[#E4E7EC] bg-white text-[#667085] hover:border-[#C9962C]/50'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#667085] mb-1.5">Position</label>
              <div className="flex gap-1">
                {ALIGN_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateConfig(block, onUpdate, { headerAlign: opt.value })}
                    className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${headerAlign === opt.value
                      ? 'border-[#C9962C] bg-[#FFFBF2] text-[#1B2340]'
                      : 'border-[#E4E7EC] bg-white text-[#667085] hover:border-[#C9962C]/50'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#667085] mb-1.5">Height</label>
              <div className="flex gap-1">
                {PADDING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateConfig(block, onUpdate, { padding: opt.value })}
                    className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${padding === opt.value
                      ? 'border-[#C9962C] bg-[#FFFBF2] text-[#1B2340]'
                      : 'border-[#E4E7EC] bg-white text-[#667085] hover:border-[#C9962C]/50'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => updateConfig(block, onUpdate, { locked: true })}
            className="px-4 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-semibold hover:bg-[#242b52] transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </BlockShell>
  )
}

export function TextBlock({ block, onUpdate, onRemove }) {
  const isLocked = !!block.config.locked
  const align = block.config.textAlign || 'left'

  return (
    <BlockShell onRemove={onRemove} locked={isLocked}>
      <div
        className="relative"
        onDoubleClick={() => isLocked && updateConfig(block, onUpdate, { locked: false })}
      >
        <div style={{ padding: '20px' }}>
          <textarea
            value={block.config.content}
            onChange={(e) => updateConfig(block, onUpdate, { content: e.target.value })}
            placeholder="Add your text content here"
            rows={3}
            spellCheck={false}
            autoCorrect="off"
            readOnly={isLocked}
            className={`rounded px-1 transition-shadow ${isLocked ? 'resize-none' : 'resize-y hover:ring-1 hover:ring-[#E4E7EC] focus:ring-1 focus:ring-[#C9962C]/50'
              }`}
            style={inlineFieldStyle({
              fontSize: block.config.fontSize,
              color: block.config.textColor,
              textAlign: align,
              cursor: isLocked ? 'default' : 'text',
            })}
          />
        </div>
      </div>

      {!isLocked && (
        <div className="px-4 py-2.5 border-t border-[#E4E7EC] bg-[#F5F6F8] space-y-2.5">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-[#667085]">
              Text color
              <input
                type="color"
                value={block.config.textColor}
                onChange={(e) => updateConfig(block, onUpdate, { textColor: e.target.value })}
                className="w-6 h-6 rounded border border-[#E4E7EC] cursor-pointer"
              />
            </label>
            <div className="flex items-center gap-1.5 text-xs text-[#667085]">
              Align
              <div className="flex rounded-md border border-[#E4E7EC] overflow-hidden">
                {['left', 'center', 'right'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    title={opt}
                    onClick={() => updateConfig(block, onUpdate, { textAlign: opt })}
                    className={`px-2.5 py-1 text-xs capitalize transition-colors ${align === opt
                      ? 'bg-[#1B2340] text-white'
                      : 'bg-white text-[#667085] hover:bg-[#F5F6F8]'
                      }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateConfig(block, onUpdate, { locked: true })}
            className="px-4 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-semibold hover:bg-[#242b52] transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </BlockShell>
  )
}

const POSITION_OPTIONS = [
  { value: 'left top', label: 'Top left' },
  { value: 'center top', label: 'Top' },
  { value: 'right top', label: 'Top right' },
  { value: 'left center', label: 'Left' },
  { value: 'center center', label: 'Center' },
  { value: 'right center', label: 'Right' },
  { value: 'left bottom', label: 'Bottom left' },
  { value: 'center bottom', label: 'Bottom' },
  { value: 'right bottom', label: 'Bottom right' },
]

const SIZE_OPTIONS = [
  { value: '25%', label: '25%' },
  { value: '50%', label: '50%' },
  { value: '75%', label: '75%' },
  { value: '100%', label: 'Full' },
]

const ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Middle' },
  { value: 'right', label: 'Right' },
]

export function HeroBlock({ block, onUpdate, onRemove }) {
  const fileInputRef = React.useRef(null)
  const [uploadError, setUploadError] = React.useState('')
  const [showUrlField, setShowUrlField] = React.useState(false)
  const isDataUrl = typeof block.config.imageUrl === 'string' && block.config.imageUrl.startsWith('data:')
  const isLocked = !!block.config.locked
  const imageWidth = block.config.imageWidth || '100%'
  const imageAlign = block.config.imageAlign || 'center'
  const hasSideSpace = imageWidth !== '100%'
  const sideText = block.config.sideText || ''

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file.')
      return
    }
    // Keep it reasonable since this gets stored as a base64 string in the
    // template JSON — a multi-MB photo would bloat every save/load.
    if (file.size > 3 * 1024 * 1024) {
      setUploadError('Image is too large — please use a file under 3MB.')
      return
    }

    setUploadError('')
    const reader = new FileReader()
    reader.onload = () => {
      updateConfig(block, onUpdate, { imageUrl: reader.result, altText: block.config.altText || file.name })
    }
    reader.onerror = () => setUploadError('Could not read that file — please try again.')
    reader.readAsDataURL(file)

    // allow re-selecting the same file later if they change their mind
    e.target.value = ''
  }

  const imageEl = (
    <img
      src={block.config.imageUrl}
      alt={block.config.altText}
      style={{
        width: hasSideSpace ? '100%' : imageWidth,
        height: block.config.height,
        objectFit: 'cover',
        objectPosition: block.config.objectPosition || 'center center',
        display: 'block',
      }}
    />
  )

  const sideTextEl = (
    <textarea
      value={sideText}
      onChange={(e) => updateConfig(block, onUpdate, { sideText: e.target.value })}
      placeholder="Write something next to the photo..."
      readOnly={isLocked}
      spellCheck={false}
      autoCorrect="off"
      className={`w-full h-full rounded px-1 resize-none transition-shadow ${isLocked ? '' : 'hover:ring-1 hover:ring-[#E4E7EC] focus:ring-1 focus:ring-[#C9962C]/50'
        }`}
      style={inlineFieldStyle({
        color: block.config.sideTextColor || '#333333',
        fontSize: '15px',
        lineHeight: '1.6',
        cursor: isLocked ? 'default' : 'text',
      })}
    />
  )

  return (
    <BlockShell onRemove={onRemove} locked={isLocked}>
      <div
        className="relative"
        onDoubleClick={() => isLocked && updateConfig(block, onUpdate, { locked: false })}
      >
        {hasSideSpace ? (
          // Image takes its configured width; the remaining width becomes
          // an editable text column, ordered so the text always sits on
          // the opposite side of wherever the image is aligned.
          <div
            style={{
              display: 'flex',
              height: block.config.height,
              flexDirection: imageAlign === 'left' ? 'row' : imageAlign === 'right' ? 'row-reverse' : 'row',
            }}
          >
            <div style={{ width: imageWidth, flexShrink: 0 }}>{imageEl}</div>
            {imageAlign !== 'center' && (
              <div style={{ flex: 1, padding: '16px' }}>{sideTextEl}</div>
            )}
          </div>
        ) : (
          imageEl
        )}
      </div>

      {!isLocked && (
        <div className="space-y-3 px-4 py-3 border-t border-[#E4E7EC] bg-[#F5F6F8]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-md border border-[#E4E7EC] bg-white text-xs font-medium text-[#1B2340] hover:border-[#C9962C] hover:text-[#C9962C] transition-colors"
            >
              Upload photo
            </button>
            {isDataUrl && !showUrlField ? (
              <span className="text-xs text-[#12B76A]">Photo uploaded ✓</span>
            ) : (
              <button
                type="button"
                onClick={() => setShowUrlField((v) => !v)}
                className="text-xs text-[#667085] hover:text-[#C9962C] transition-colors underline-offset-2 hover:underline"
              >
                {showUrlField ? 'Hide URL field' : 'or paste a URL instead'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

          {(showUrlField || !isDataUrl) && (
            <div>
              <label className="block text-xs text-[#667085] mb-1">Image URL</label>
              <input
                type="text"
                spellCheck={false}
                autoCorrect="off"
                value={isDataUrl ? '' : block.config.imageUrl}
                placeholder={isDataUrl ? 'Paste a URL to replace the uploaded photo' : ''}
                onChange={(e) => updateConfig(block, onUpdate, { imageUrl: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C] truncate"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-[#667085] mb-1">Alt text</label>
            <input
              type="text"
              spellCheck={false}
              autoCorrect="off"
              value={block.config.altText}
              onChange={(e) => updateConfig(block, onUpdate, { altText: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-md border border-[#E4E7EC] text-sm bg-white focus:outline-none focus:border-[#C9962C]"
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <label className="block text-xs text-[#667085] mb-1.5">Photo size</label>
              <div className="flex gap-1">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateConfig(block, onUpdate, { imageWidth: opt.value })}
                    className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${imageWidth === opt.value
                      ? 'border-[#C9962C] bg-[#FFFBF2] text-[#1B2340]'
                      : 'border-[#E4E7EC] bg-white text-[#667085] hover:border-[#C9962C]/50'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {hasSideSpace && (
                <p className="text-[11px] text-[#98A2B3] mt-1">
                  Remaining space becomes a text box you can write in.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-[#667085] mb-1.5">Photo position</label>
              <div className="flex gap-1">
                {ALIGN_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateConfig(block, onUpdate, { imageAlign: opt.value })}
                    className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${imageAlign === opt.value
                      ? 'border-[#C9962C] bg-[#FFFBF2] text-[#1B2340]'
                      : 'border-[#E4E7EC] bg-white text-[#667085] hover:border-[#C9962C]/50'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#667085] mb-1.5">Crop position (within photo)</label>
            <div className="grid grid-cols-3 gap-1 w-fit">
              {POSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.label}
                  onClick={() => updateConfig(block, onUpdate, { objectPosition: opt.value })}
                  className={`w-8 h-8 rounded border flex items-center justify-center transition-colors ${(block.config.objectPosition || 'center center') === opt.value
                    ? 'border-[#C9962C] bg-[#FFFBF2]'
                    : 'border-[#E4E7EC] bg-white hover:border-[#C9962C]/50'
                    }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${(block.config.objectPosition || 'center center') === opt.value
                      ? 'bg-[#C9962C]'
                      : 'bg-[#D0D5DD]'
                      }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => updateConfig(block, onUpdate, { locked: true })}
              className="px-4 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-semibold hover:bg-[#242b52] transition-colors"
            >
              Done — show photo only
            </button>
          </div>
        </div>
      )}
    </BlockShell>
  )
}

export function GalleryBlock({ block, onUpdate, onRemove }) {
  const fileInputRef = React.useRef(null)
  const [uploadError, setUploadError] = React.useState('')
  const isLocked = !!block.config.locked
  const columns = block.config.columns || 3
  const images = block.config.images || []

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const oversized = files.some((f) => f.size > 3 * 1024 * 1024)
    const notImage = files.some((f) => !f.type.startsWith('image/'))

    if (notImage) {
      setUploadError('One or more files are not images.')
      e.target.value = ''
      return
    }
    if (oversized) {
      setUploadError('Each photo must be under 3MB.')
      e.target.value = ''
      return
    }

    setUploadError('')

    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () =>
              resolve({
                id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                url: reader.result,
                altText: file.name,
              })
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
      )
    )
      .then((newImages) => {
        updateConfig(block, onUpdate, { images: [...images, ...newImages] })
      })
      .catch(() => setUploadError('Could not read one of those files — please try again.'))

    e.target.value = ''
  }

  const handleRemoveImage = (id) => {
    updateConfig(block, onUpdate, { images: images.filter((img) => img.id !== id) })
  }

  return (
    <BlockShell onRemove={onRemove} locked={isLocked}>
      <div
        className="relative"
        onDoubleClick={() => isLocked && updateConfig(block, onUpdate, { locked: false })}
      >
        <div style={{ padding: '20px' }}>
          {images.length === 0 ? (
            <div
              style={{
                border: '1px dashed #ccc',
                borderRadius: '8px',
                padding: '40px 20px',
                textAlign: 'center',
                color: '#98A2B3',
                fontSize: '13px',
              }}
            >
              No photos yet — upload some below.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: '10px',
              }}
            >
              {images.map((img) => (
                <div key={img.id} className="group/photo relative">
                  <img
                    src={img.url}
                    alt={img.altText}
                    style={{
                      width: '100%',
                      height: '120px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      display: 'block',
                    }}
                  />
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-1 right-1 w-5 h-5 rounded bg-white/90 border border-[#E4E7EC] text-red-600 opacity-0 group-hover/photo:opacity-100 hover:bg-red-50 transition-all flex items-center justify-center text-[10px]"
                      title="Remove photo"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!isLocked && (
        <div className="space-y-3 px-4 py-3 border-t border-[#E4E7EC] bg-[#F5F6F8]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-md border border-[#E4E7EC] bg-white text-xs font-medium text-[#1B2340] hover:border-[#C9962C] hover:text-[#C9962C] transition-colors"
            >
              Upload photos
            </button>
            <span className="text-xs text-[#98A2B3]">
              {images.length > 0 ? `${images.length} photo${images.length > 1 ? 's' : ''}` : 'Select multiple at once'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesChange}
              className="hidden"
            />
          </div>

          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

          <div>
            <label className="block text-xs text-[#667085] mb-1.5">Columns</label>
            <div className="flex gap-1">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => updateConfig(block, onUpdate, { columns: n })}
                  className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${columns === n
                    ? 'border-[#C9962C] bg-[#FFFBF2] text-[#1B2340]'
                    : 'border-[#E4E7EC] bg-white text-[#667085] hover:border-[#C9962C]/50'
                    }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => updateConfig(block, onUpdate, { locked: true })}
            className="px-4 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-semibold hover:bg-[#242b52] transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </BlockShell>
  )
}

// Fixed, render-only cover page block. Only ever appears — locked — as the
// first block on the newsletter's permanent Cover page (see
// TemplateBuilder's makeFixedPages()). Deliberately not added to
// BlockPalette.jsx: coordinators should never be able to drag/click a
// second one of these onto a regular page.
export function CoverPageBlock({ block, onUpdate }) {
  const cfg = block.config
  const isLocked = !!cfg.locked
  const patch = (p) => onUpdate(block.id, { config: { ...cfg, ...p } })

  const lineStyle = (extra = {}) => ({
    background: 'transparent',
    border: 'none',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    cursor: isLocked ? 'default' : 'text',
    ...extra,
  })
  const lineClass = isLocked ? '' : 'rounded hover:ring-1 hover:ring-[#C9962C]/40 focus:ring-1 focus:ring-[#C9962C]/60'

  return (
    <div
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      onDoubleClick={() => isLocked && patch({ locked: false })}
    >
      {/* Logo + campus photo band */}
      <div style={{ display: 'flex', alignItems: 'stretch', height: '140px', backgroundColor: '#EFEAD9' }}>
        <div
          style={{
            width: '140px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px',
          }}
        >
          <img
            src={cfg.logoUrl}
            alt="Institute logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <img
            src={cfg.photoUrl}
            alt="Campus photo"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>

      {/* Title block */}
      <div style={{ padding: '14px 20px 10px 20px' }}>
        <input
          value={cfg.orgShort}
          readOnly={isLocked}
          onChange={(e) => patch({ orgShort: e.target.value })}
          className={lineClass}
          style={lineStyle({
            color: '#C0392B',
            fontSize: '30px',
            fontWeight: 800,
            fontFamily: 'Georgia, serif',
          })}
        />
        <input
          value={cfg.orgFull}
          readOnly={isLocked}
          onChange={(e) => patch({ orgFull: e.target.value })}
          className={lineClass}
          style={lineStyle({
            color: '#1B2340',
            fontSize: '17px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            marginTop: '2px',
            marginBottom: '6px',
          })}
        />
        <input
          value={cfg.accreditation}
          readOnly={isLocked}
          onChange={(e) => patch({ accreditation: e.target.value })}
          className={lineClass}
          style={lineStyle({ fontSize: '12px', color: '#333' })}
        />
        <input
          value={cfg.location}
          readOnly={isLocked}
          onChange={(e) => patch({ location: e.target.value })}
          className={lineClass}
          style={lineStyle({ fontSize: '12px', color: '#333' })}
        />
      </div>

      {/* Volume / issue banner */}
      <div
        style={{
          backgroundColor: '#242F84',
          color: '#fff',
          padding: '10px 20px',
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          fontSize: '15px',
          fontWeight: 700,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Volume -</span>
          <input
            value={cfg.volume}
            readOnly={isLocked}
            onChange={(e) => patch({ volume: e.target.value })}
            className={lineClass}
            style={lineStyle({ color: '#fff', width: 'auto', minWidth: '40px' })}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Issue –</span>
          <input
            value={cfg.issue}
            readOnly={isLocked}
            onChange={(e) => patch({ issue: e.target.value })}
            className={lineClass}
            style={lineStyle({ color: '#fff', width: 'auto', minWidth: '40px' })}
          />
        </div>
        <input
          value={cfg.issueLabel}
          readOnly={isLocked}
          onChange={(e) => patch({ issueLabel: e.target.value })}
          className={lineClass}
          style={lineStyle({ color: '#fff', width: 'auto', flex: 1, minWidth: '200px' })}
        />
      </div>

      {/* Decorative background — generic geometric shapes in the same blue
          palette as the original, standing in for the watermarked stock
          artwork that can't be reproduced. */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: '300px',
          background: 'linear-gradient(160deg, #0b1e4d 0%, #123a7a 40%, #1c5aa8 70%, #2f7bc4 100%)',
          overflow: 'hidden',
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 600 700"
          style={{ position: 'absolute', inset: 0 }}
          preserveAspectRatio="xMidYMid slice"
        >
          <circle cx="430" cy="260" r="150" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="18" />
          <circle cx="430" cy="260" r="100" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="10" />
          <circle cx="430" cy="260" r="40" fill="rgba(255,255,255,0.2)" />
          <circle cx="150" cy="500" r="90" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="14" />
          <circle cx="90" cy="620" r="60" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
        </svg>
      </div>

      {!isLocked && (
        <div style={{ padding: '10px 20px', backgroundColor: '#F5F6F8', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => patch({ locked: true })}
            className="px-4 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-semibold hover:bg-[#242b52] transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}

// Fixed, render-only masthead page block. Mirrors CoverPageBlock's role —
// only ever appears locked as the About page's single block (see
// TemplateBuilder's makeFixedPages()). Not added to BlockPalette.jsx.
export function MastheadPageBlock({ block, onUpdate }) {
  const cfg = block.config
  const isLocked = !!cfg.locked
  const founders = [cfg.founder1, cfg.founder2].filter(Boolean)

  const patch = (p) => onUpdate(block.id, { config: { ...cfg, ...p } })
  const patchFounder = (key, field, value) => patch({ [key]: { ...cfg[key], [field]: value } })
  const patchContentsRow = (idx, field, value) =>
    patch({ contents: cfg.contents.map((row, i) => (i === idx ? { ...row, [field]: value } : row)) })
  const patchEditorialName = (idx, value) =>
    patch({ editorialBoard: cfg.editorialBoard.map((name, i) => (i === idx ? value : name)) })

  const lineStyle = (extra = {}) => ({
    background: 'transparent',
    border: 'none',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    cursor: isLocked ? 'default' : 'text',
    ...extra,
  })
  const lineClass = isLocked ? '' : 'rounded hover:ring-1 hover:ring-[#C9962C]/40 focus:ring-1 focus:ring-[#C9962C]/60'

  return (
    <div
      style={{ padding: '20px' }}
      onDoubleClick={() => isLocked && patch({ locked: false })}
    >
      {/* Header: logo + org name, founder portraits */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={cfg.logoUrl}
            alt="Institute logo"
            style={{ width: '64px', height: '64px', objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <input
              value={cfg.orgShort}
              readOnly={isLocked}
              onChange={(e) => patch({ orgShort: e.target.value })}
              className={lineClass}
              style={lineStyle({
                color: '#C0392B',
                fontSize: '22px',
                fontWeight: 800,
                fontFamily: 'Georgia, serif',
                lineHeight: 1,
              })}
            />
            <input
              value={cfg.orgFull}
              readOnly={isLocked}
              onChange={(e) => patch({ orgFull: e.target.value })}
              className={lineClass}
              style={lineStyle({ color: '#1B2340', fontSize: '12px', fontWeight: 700 })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          {founders.map((f, i) => {
            const key = i === 0 ? 'founder1' : 'founder2'
            return (
              <div key={i} style={{ textAlign: 'center', width: '110px' }}>
                <img
                  src={f.photoUrl}
                  alt={f.name}
                  style={{
                    width: '70px',
                    height: '70px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    margin: '0 auto 4px',
                    display: 'block',
                  }}
                />
                <input
                  value={f.name}
                  readOnly={isLocked}
                  onChange={(e) => patchFounder(key, 'name', e.target.value)}
                  className={lineClass}
                  style={lineStyle({ fontSize: '9px', color: '#C0392B', fontWeight: 700, textAlign: 'center' })}
                />
                <input
                  value={f.role}
                  readOnly={isLocked}
                  onChange={(e) => patchFounder(key, 'role', e.target.value)}
                  className={lineClass}
                  style={lineStyle({ fontSize: '9px', color: '#333', textAlign: 'center' })}
                />
                <input
                  value={f.org}
                  readOnly={isLocked}
                  onChange={(e) => patchFounder(key, 'org', e.target.value)}
                  className={lineClass}
                  style={lineStyle({ fontSize: '9px', color: '#333', textAlign: 'center' })}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ backgroundColor: '#FBD9B0', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: '13px' }}>Vision</p>
            <textarea
              value={cfg.vision}
              readOnly={isLocked}
              rows={4}
              onChange={(e) => patch({ vision: e.target.value })}
              className={`resize-none ${lineClass}`}
              style={lineStyle({ fontSize: '11px', lineHeight: 1.5, marginBottom: '10px' })}
            />
            <p style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: '13px' }}>Mission</p>
            <textarea
              value={cfg.mission}
              readOnly={isLocked}
              rows={3}
              onChange={(e) => patch({ mission: e.target.value })}
              className={`resize-none ${lineClass}`}
              style={lineStyle({ fontSize: '11px', lineHeight: 1.5 })}
            />
          </div>

          <div style={{ backgroundColor: '#F2F4F7', borderRadius: '10px', padding: '14px', fontSize: '11px', lineHeight: 1.8 }}>
            {[
              ['phone', 'PHONE:'],
              ['website', 'WEBSITE:'],
              ['email', 'EMAIL:'],
              ['twitter', 'TWITTER:'],
              ['facebook', 'FACEBOOK:'],
              ['linkedin', 'LINKEDIN:'],
              ['youtube', 'YOUTUBE:'],
            ].map(([key, label]) => (
              <div key={key} style={{ marginBottom: '8px' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{label}</p>
                <input
                  value={cfg[key]}
                  readOnly={isLocked}
                  onChange={(e) => patch({ [key]: e.target.value })}
                  className={lineClass}
                  style={lineStyle({ color: key === 'phone' || key === 'email' ? 'inherit' : '#1a56db' })}
                />
              </div>
            ))}

            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <img
                src={cfg.principalPhotoUrl}
                alt={cfg.presentedByName}
                style={{
                  width: '80px',
                  height: '80px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  margin: '0 auto 6px',
                  display: 'block',
                }}
              />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '11px' }}>Presented by:</p>
              <input
                value={cfg.presentedByName}
                readOnly={isLocked}
                onChange={(e) => patch({ presentedByName: e.target.value })}
                className={lineClass}
                style={lineStyle({ fontWeight: 700, fontSize: '11px', color: '#C0392B', textAlign: 'center' })}
              />
              <input
                value={cfg.presentedByRole}
                readOnly={isLocked}
                onChange={(e) => patch({ presentedByRole: e.target.value })}
                className={lineClass}
                style={lineStyle({ fontSize: '11px', textAlign: 'center' })}
              />
            </div>
          </div>
        </div>

        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '14px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', backgroundColor: '#F2F4F7', padding: '6px', textAlign: 'left' }}>
                  Contents
                </th>
                <th style={{ border: '1px solid #ccc', backgroundColor: '#F2F4F7', padding: '6px' }}>Page no.</th>
              </tr>
            </thead>
            <tbody>
              {(cfg.contents || []).map((row, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>
                    <input
                      value={row.label}
                      readOnly={isLocked}
                      onChange={(e) => patchContentsRow(i, 'label', e.target.value)}
                      className={lineClass}
                      style={lineStyle({ fontStyle: 'italic' })}
                    />
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'center' }}>
                    <input
                      value={row.page}
                      readOnly={isLocked}
                      onChange={(e) => patchContentsRow(i, 'page', e.target.value)}
                      className={lineClass}
                      style={lineStyle({ fontStyle: 'italic', textAlign: 'center' })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              backgroundColor: '#D6E4F0',
              border: '2px solid #1B2340',
              borderRadius: '6px',
              padding: '14px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontWeight: 800, fontSize: '12px' }}>EDITORIAL BOARD</p>
            {(cfg.editorialBoard || []).map((name, i) => (
              <input
                key={i}
                value={name}
                readOnly={isLocked}
                onChange={(e) => patchEditorialName(i, e.target.value)}
                className={lineClass}
                style={lineStyle({
                  margin: '2px 0',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: i % 2 === 0 ? '#C0392B' : '#1B2340',
                  textAlign: 'center',
                })}
              />
            ))}
          </div>
        </div>
      </div>

      {!isLocked && (
        <div className="pt-4 flex justify-end">
          <button
            type="button"
            onClick={() => patch({ locked: true })}
            className="px-4 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-semibold hover:bg-[#242b52] transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}

// Fixed, render-only back cover block. Always pinned as the final page of
// every template (see TemplateBuilder's makeBackFixedPage() and the
// "insert before back cover" logic in handleAddPage). Not added to
// BlockPalette.jsx.
export function BackCoverPageBlock({ block }) {
  const cfg = block.config

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ position: 'relative', flex: 1, minHeight: '300px', overflow: 'hidden' }}>
        <img
          src={cfg.photoUrl}
          alt="Campus grounds"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            backgroundColor: '#EFEAD9',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderBottomLeftRadius: '40px',
          }}
        >
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                color: '#C0392B',
                fontSize: '15px',
                fontWeight: 800,
                fontFamily: 'Georgia, serif',
                lineHeight: 1,
              }}
            >
              {cfg.orgShort}
            </div>
            <div style={{ color: '#1B2340', fontSize: '9px', fontWeight: 700 }}>{cfg.orgFull}</div>
          </div>
          <img src={cfg.logoUrl} alt="Institute logo" style={{ width: '44px', height: '44px', objectFit: 'contain' }} />
        </div>
      </div>

      <div
        style={{
          backgroundColor: '#6FC29A',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={cfg.logoUrl}
            alt="Institute logo"
            style={{ width: '54px', height: '54px', objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <div
              style={{
                color: '#C0392B',
                fontSize: '18px',
                fontWeight: 800,
                fontFamily: 'Georgia, serif',
                lineHeight: 1,
              }}
            >
              {cfg.orgShort}
            </div>
            <div style={{ color: '#1B2340', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
              {cfg.orgFull}
            </div>
            <p style={{ margin: 0, fontSize: '10px', color: '#1B2340' }}>{cfg.address}</p>
            <p style={{ margin: 0, fontSize: '10px', color: '#1B2340', fontWeight: 700 }}>{cfg.emailLine}</p>
            <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#1B2340' }}>{cfg.socialLine}</p>
          </div>
        </div>

        <img
          src={cfg.qrUrl}
          alt="QR code"
          style={{ width: '70px', height: '70px', objectFit: 'contain', backgroundColor: '#fff', padding: '4px', borderRadius: '4px' }}
        />
      </div>
    </div>
  )
}

export function EventsGridBlock({ block, onUpdate, onRemove }) {
  const isLocked = !!block.config.locked
  const { events: realEvents, loading } = useEventsData(block.config.eventIds)
  const hasRealEvents = (block.config.eventIds || []).length > 0

  return (
    <BlockShell onRemove={onRemove} locked={isLocked}>
      <div
        className="relative"
        onDoubleClick={() => isLocked && updateConfig(block, onUpdate, { locked: false })}
      >
        <div style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 4px 0' }}>Events Grid</h3>
          <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>
            {block.config.columns} columns, {block.config.eventsPerPage} events
            {hasRealEvents && loading && ' · loading event...'}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${block.config.columns}, 1fr)`,
              gap: '16px',
            }}
          >
            {hasRealEvents
              ? realEvents.map((ev) => (
                <div key={ev._id} style={{ border: '1px solid #E4E7EC', padding: '14px', borderRadius: '8px' }}>
                  <p style={{ fontWeight: 'bold', margin: 0 }}>{ev.eventName}</p>
                  {block.config.showDate && (
                    <p style={{ fontSize: '12px', margin: '5px 0' }}>
                      {ev.eventDate ? new Date(ev.eventDate).toLocaleDateString() : ''}
                    </p>
                  )}
                  {block.config.showLocation && (
                    <p style={{ fontSize: '12px', margin: '5px 0' }}>{ev.location}</p>
                  )}
                </div>
              ))
              : [1, 2, 3, 4].map((i) => (
                <div key={i} style={{ border: '1px solid #E4E7EC', padding: '14px', borderRadius: '8px' }}>
                  <p style={{ fontWeight: 'bold', margin: 0 }}>Event {i}</p>
                  {block.config.showDate && <p style={{ fontSize: '12px', margin: '5px 0' }}>Date</p>}
                  {block.config.showLocation && <p style={{ fontSize: '12px', margin: '5px 0' }}>Location</p>}
                </div>
              ))}
          </div>
        </div>
      </div>

      {!isLocked && (
        <div className="px-4 py-2.5 border-t border-[#E4E7EC] bg-[#F5F6F8] space-y-2.5">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-[#667085]">
              Columns
              <select
                value={block.config.columns}
                onChange={(e) => updateConfig(block, onUpdate, { columns: Number(e.target.value) })}
                className="px-1.5 py-1 rounded border border-[#E4E7EC] bg-white text-xs"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#667085]">
              Per page
              <input
                type="number"
                min={1}
                max={12}
                value={block.config.eventsPerPage}
                onChange={(e) => updateConfig(block, onUpdate, { eventsPerPage: Number(e.target.value) })}
                className="w-14 px-1.5 py-1 rounded border border-[#E4E7EC] bg-white text-xs"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#667085]">
              <input
                type="checkbox"
                checked={block.config.showDate}
                onChange={(e) => updateConfig(block, onUpdate, { showDate: e.target.checked })}
              />
              Show date
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#667085]">
              <input
                type="checkbox"
                checked={block.config.showLocation}
                onChange={(e) => updateConfig(block, onUpdate, { showLocation: e.target.checked })}
              />
              Show location
            </label>
          </div>
          <button
            type="button"
            onClick={() => updateConfig(block, onUpdate, { locked: true })}
            className="px-4 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-semibold hover:bg-[#242b52] transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </BlockShell>
  )
}

export function DividerBlock({ block, onUpdate, onRemove }) {
  const isLocked = !!block.config.locked

  return (
    <BlockShell onRemove={onRemove} locked={isLocked}>
      <div
        className="relative"
        onDoubleClick={() => isLocked && updateConfig(block, onUpdate, { locked: false })}
      >
        <div
          style={{
            margin: block.config.margin,
            borderTop: `${block.config.height} solid ${block.config.color}`,
          }}
        />
      </div>

      {!isLocked && (
        <div className="px-4 py-2.5 border-t border-[#E4E7EC] bg-[#F5F6F8] space-y-2.5">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-[#667085]">
              Color
              <input
                type="color"
                value={block.config.color}
                onChange={(e) => updateConfig(block, onUpdate, { color: e.target.value })}
                className="w-6 h-6 rounded border border-[#E4E7EC] cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#667085]">
              Thickness
              <input
                type="text"
                spellCheck={false}
                autoCorrect="off"
                value={block.config.height}
                onChange={(e) => updateConfig(block, onUpdate, { height: e.target.value })}
                className="w-14 px-1.5 py-1 rounded border border-[#E4E7EC] bg-white text-xs"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => updateConfig(block, onUpdate, { locked: true })}
            className="px-4 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-semibold hover:bg-[#242b52] transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </BlockShell>
  )
}

export function ButtonBlock({ block, onUpdate, onRemove }) {
  const isLocked = !!block.config.locked
  const align = block.config.align || 'center'

  return (
    <BlockShell onRemove={onRemove} locked={isLocked}>
      <div
        className="relative"
        onDoubleClick={() => isLocked && updateConfig(block, onUpdate, { locked: false })}
      >
        <div style={{ textAlign: align, padding: '24px' }}>
          <input
            type="text"
            spellCheck={false}
            autoCorrect="off"
            value={block.config.text}
            onChange={(e) => updateConfig(block, onUpdate, { text: e.target.value })}
            placeholder="Click Here"
            readOnly={isLocked}
            className={`transition-shadow ${isLocked ? '' : 'hover:ring-1 hover:ring-black/10 focus:ring-1 focus:ring-black/20'}`}
            style={{
              backgroundColor: block.config.backgroundColor,
              color: block.config.textColor,
              padding: '12px 30px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: 'bold',
              textAlign: 'center',
              outline: 'none',
              cursor: isLocked ? 'default' : 'text',
            }}
          />
        </div>
      </div>

      {!isLocked && (
        <div className="px-4 py-2.5 border-t border-[#E4E7EC] bg-[#F5F6F8] space-y-2.5">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-[#667085]">
              Link URL
              <input
                type="text"
                spellCheck={false}
                autoCorrect="off"
                value={block.config.url}
                onChange={(e) => updateConfig(block, onUpdate, { url: e.target.value })}
                className="w-32 px-1.5 py-1 rounded border border-[#E4E7EC] bg-white text-xs"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#667085]">
              Background
              <input
                type="color"
                value={block.config.backgroundColor}
                onChange={(e) => updateConfig(block, onUpdate, { backgroundColor: e.target.value })}
                className="w-6 h-6 rounded border border-[#E4E7EC] cursor-pointer"
              />
            </label>
            <div className="flex items-center gap-1.5 text-xs text-[#667085]">
              Position
              <div className="flex rounded-md border border-[#E4E7EC] overflow-hidden">
                {['left', 'center', 'right'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    title={opt}
                    onClick={() => updateConfig(block, onUpdate, { align: opt })}
                    className={`px-2.5 py-1 text-xs capitalize transition-colors ${align === opt
                      ? 'bg-[#1B2340] text-white'
                      : 'bg-white text-[#667085] hover:bg-[#F5F6F8]'
                      }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateConfig(block, onUpdate, { locked: true })}
            className="px-4 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-semibold hover:bg-[#242b52] transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </BlockShell>
  )
}

export function FooterBlock({ block, onUpdate, onRemove }) {
  const isLocked = !!block.config.locked

  const updateLink = (idx, patch) => {
    const links = block.config.links.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    updateConfig(block, onUpdate, { links })
  }

  return (
    <BlockShell onRemove={onRemove} locked={isLocked}>
      <div
        className="relative"
        onDoubleClick={() => isLocked && updateConfig(block, onUpdate, { locked: false })}
      >
        <div style={{ backgroundColor: '#F5F6F8', textAlign: 'center', padding: '6px 12px', color: '#666' }}>
          <input
            type="text"
            spellCheck={false}
            autoCorrect="off"
            value={block.config.text}
            onChange={(e) => updateConfig(block, onUpdate, { text: e.target.value })}
            placeholder="© 2026 College Newsletter"
            readOnly={isLocked}
            className={`rounded transition-shadow ${isLocked ? '' : 'hover:ring-1 hover:ring-black/10 focus:ring-1 focus:ring-black/20'
              }`}
            style={inlineFieldStyle({
              color: 'inherit',
              fontSize: '11px',
              textAlign: 'center',
              marginBottom: '2px',
              cursor: isLocked ? 'default' : 'text',
            })}
          />
          <div className="flex flex-wrap justify-center gap-2">
            {block.config.links.map((link, idx) => (
              <input
                key={idx}
                type="text"
                spellCheck={false}
                autoCorrect="off"
                value={link.text}
                readOnly={isLocked}
                onChange={(e) => updateLink(idx, { text: e.target.value })}
                className={`rounded px-1 transition-shadow ${isLocked ? '' : 'hover:ring-1 hover:ring-black/10 focus:ring-1 focus:ring-black/20'
                  }`}
                style={inlineFieldStyle({
                  color: '#C9962C',
                  fontSize: '11px',
                  width: `${Math.max((link.text || '').length, 3) + 1}ch`,
                  textAlign: 'center',
                  cursor: isLocked ? 'default' : 'text',
                })}
              />
            ))}
          </div>
        </div>
      </div>

      {!isLocked && (
        <div className="px-4 py-2.5 border-t border-[#E4E7EC] bg-white flex justify-end">
          <button
            type="button"
            onClick={() => updateConfig(block, onUpdate, { locked: true })}
            className="px-4 py-1.5 rounded-md bg-[#1B2340] text-white text-xs font-semibold hover:bg-[#242b52] transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </BlockShell>
  )
}