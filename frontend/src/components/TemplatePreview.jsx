import React from 'react'
import { useEventsData } from '../hooks/useEventsData'
import { CoverPageBlock, MastheadPageBlock, BackCoverPageBlock } from './BlockPaletteBlocks'

function EventsGridPreview({ block }) {
    const hasRealEvents = (block.config.eventIds || []).length > 0

    const { events: realEvents, loading } = useEventsData(
        block.config.eventIds || []
    )

    return (
        <div key={block.id} style={{ padding: '40px' }}>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${block.config.columns}, 1fr)`,
                    gap: '20px',
                }}
            >
                {hasRealEvents
                    ? (loading ? [] : realEvents).map((ev) => (
                        <div
                            key={ev._id}
                            style={{
                                border: '1px solid #ddd',
                                padding: '20px',
                                borderRadius: '8px',
                                backgroundColor: '#f9f9f9',
                            }}
                        >
                            <h4 style={{ margin: '0 0 10px 0' }}>
                                {ev.eventName}
                            </h4>

                            {block.config.showDate && (
                                <p
                                    style={{
                                        margin: '5px 0',
                                        fontSize: '14px',
                                    }}
                                >
                                    {ev.eventDate
                                        ? new Date(
                                            ev.eventDate
                                        ).toLocaleDateString()
                                        : ''}
                                </p>
                            )}

                            {block.config.showLocation && (
                                <p
                                    style={{
                                        margin: '5px 0',
                                        fontSize: '14px',
                                    }}
                                >
                                    {ev.location}
                                </p>
                            )}

                            <p
                                style={{
                                    margin: '10px 0 0 0',
                                    fontSize: '12px',
                                    color: '#666',
                                }}
                            >
                                {ev.description}
                            </p>
                        </div>
                    ))
                    : [1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            style={{
                                border: '1px solid #ddd',
                                padding: '20px',
                                borderRadius: '8px',
                                backgroundColor: '#f9f9f9',
                            }}
                        >
                            <h4 style={{ margin: '0 0 10px 0' }}>
                                Event Title {i}
                            </h4>

                            {block.config.showDate && (
                                <p
                                    style={{
                                        margin: '5px 0',
                                        fontSize: '14px',
                                    }}
                                >
                                    Jan {i}, 2026
                                </p>
                            )}

                            {block.config.showLocation && (
                                <p
                                    style={{
                                        margin: '5px 0',
                                        fontSize: '14px',
                                    }}
                                >
                                    Building {i}
                                </p>
                            )}

                            <p
                                style={{
                                    margin: '10px 0 0 0',
                                    fontSize: '12px',
                                    color: '#666',
                                }}
                            >
                                Event description goes here...
                            </p>
                        </div>
                    ))}
            </div>
        </div>
    )
}

export default function TemplatePreview({ blocks = [], pageLabel }) {
    const renderBlock = (block) => {
        switch (block.type) {
            case 'header':
                return (
                    <div
                        key={block.id}
                        style={{
                            backgroundColor: block.config.backgroundColor,
                            color: block.config.textColor,
                            padding: '40px',
                            textAlign: 'center',
                        }}
                    >
                        <h1 style={{ margin: '0 0 10px 0' }}>
                            {block.config.title}
                        </h1>

                        <p style={{ margin: 0 }}>
                            {block.config.subtitle}
                        </p>
                    </div>
                )

            case 'hero':
                return (
                    <div key={block.id} style={{ width: '100%' }}>
                        <img
                            src={block.config.imageUrl}
                            alt={block.config.altText}
                            style={{
                                width: '100%',
                                height: block.config.height,
                                objectFit: 'cover',
                                objectPosition:
                                    block.config.objectPosition ||
                                    'center center',
                            }}
                        />
                    </div>
                )

            case 'cover-page':
                return <CoverPageBlock key={block.id} block={block} />

            case 'masthead-page':
                return <MastheadPageBlock key={block.id} block={block} />

            case 'backcover-page':
                return <BackCoverPageBlock key={block.id} block={block} />

            case 'text':
                return (
                    <div
                        key={block.id}
                        style={{
                            padding: '20px 40px',
                            fontSize: block.config.fontSize,
                            color: block.config.textColor,
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {block.config.content}
                    </div>
                )

            case 'gallery':
                return (
                    <div key={block.id} style={{ padding: '40px' }}>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${block.config.columns || 3}, 1fr)`,
                                gap: '10px',
                            }}
                        >
                            {(block.config.images || []).map((img) => (
                                <img
                                    key={img.id}
                                    src={img.url}
                                    alt={img.altText}
                                    style={{
                                        width: '100%',
                                        height: '140px',
                                        objectFit: 'cover',
                                        borderRadius: '6px',
                                        display: 'block',
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )

            case 'events-grid':
                return (
                    <EventsGridPreview
                        key={block.id}
                        block={block}
                    />
                )

            case 'divider':
                return (
                    <div
                        key={block.id}
                        style={{
                            margin: block.config.margin,
                            borderTop: `${block.config.height} solid ${block.config.color}`,
                        }}
                    />
                )

            case 'button':
                return (
                    <div
                        key={block.id}
                        style={{
                            textAlign: 'center',
                            padding: '30px',
                        }}
                    >
                        <button
                            style={{
                                backgroundColor:
                                    block.config.backgroundColor,
                                color: block.config.textColor,
                                padding: '14px 40px',
                                border: 'none',
                                borderRadius: '5px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                            }}
                        >
                            {block.config.text}
                        </button>
                    </div>
                )

            case 'footer':
                return (
                    <div
                        key={block.id}
                        style={{
                            backgroundColor: '#f5f5f5',
                            padding: '6px 12px',
                            textAlign: 'center',
                            color: '#666',
                            borderTop: '1px solid #ddd',
                            fontSize: '11px',
                        }}
                    >
                        <p style={{ margin: '0 0 2px 0' }}>
                            {block.config.text}
                        </p>

                        <div>
                            {(block.config.links || []).map(
                                (link, idx) => (
                                    <a
                                        key={idx}
                                        href={link.url}
                                        style={{
                                            marginRight: '12px',
                                            color: '#C9962C',
                                            textDecoration: 'none',
                                        }}
                                    >
                                        {link.text}
                                    </a>
                                )
                            )}
                        </div>
                    </div>
                )

            default:
                return null
        }
    }

    return (
        <div className="bg-white border border-[#E4E7EC] rounded-lg p-4 sticky top-4">
            <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-[0.15em] text-[#667085] font-semibold">
                    Live Preview
                </p>

                {pageLabel && (
                    <span className="text-[11px] text-[#C9962C] font-medium bg-[#FFFBF2] border border-[#C9962C]/30 rounded px-2 py-0.5">
                        {pageLabel}
                    </span>
                )}
            </div>

            <div className="border border-[#E4E7EC] rounded-md overflow-hidden max-h-[70vh] overflow-y-auto">
                {blocks.length === 0 ? (
                    <div className="p-10 text-center">
                        <p className="text-sm text-[#98A2B3]">
                            Add blocks to see preview
                        </p>
                    </div>
                ) : (
                    <div style={{ backgroundColor: 'white' }}>
                        {blocks
                            .filter((b) => b.type !== 'footer')
                            .map((block) => renderBlock(block))}

                        {blocks
                            .filter((b) => b.type === 'footer')
                            .map((block) => renderBlock(block))}
                    </div>
                )}
            </div>
        </div>
    )
}