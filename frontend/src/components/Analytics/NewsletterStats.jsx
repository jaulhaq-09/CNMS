import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const TILES = [
  { key: 'published', label: 'Published', icon: '📰', format: (v) => v || 0 },
  { key: 'totalRecipients', label: 'Recipients', icon: '👥', format: (v) => (v || 0).toLocaleString() },
]

export default function NewsletterStats({ data = {} }) {
  const byMonth = data.byMonth || []

  return (
    <div className="bg-white border border-[#E4E7EC] rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-1 bg-gradient-to-r from-[#1B2340] to-[#3B2A3F]" />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif font-semibold text-lg text-[#1B2340]">Newsletters</h2>
          <span className="text-xs font-medium text-[#667085] bg-[#F5F6F8] rounded-full px-2.5 py-1">
            {data.published || 0} published
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {TILES.map((tile) => (
            <div key={tile.key} className="bg-[#F5F6F8] rounded-md p-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-sm">
              <p className="text-[10px] uppercase tracking-wide text-[#667085] font-semibold mb-1 flex items-center gap-1">
                <span aria-hidden="true">{tile.icon}</span> {tile.label}
              </p>
              <p className="text-xl font-serif font-semibold text-[#1B2340]">{tile.format(data[tile.key])}</p>
            </div>
          ))}
          <div className="bg-[#FBEBC9] rounded-md p-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-[#B07C1F] font-semibold mb-1 flex items-center gap-1">
              <span aria-hidden="true">📬</span> Avg Open Rate
            </p>
            <p className="text-xl font-serif font-semibold text-[#B07C1F]">{data.avgOpenRate || 0}%</p>
          </div>
          <div className="bg-[#FEF3F2] rounded-md p-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-[#C0392B] font-semibold mb-1 flex items-center gap-1">
              <span aria-hidden="true">🖱️</span> Avg Click Rate
            </p>
            <p className="text-xl font-serif font-semibold text-[#C0392B]">{data.avgClickRate || 0}%</p>
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-[#667085] font-semibold mb-3">
            Performance by Month
          </p>
          {byMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="sent" stroke="#1B2340" strokeWidth={2} dot={false} name="Sent" animationDuration={600} />
                <Line type="monotone" dataKey="opened" stroke="#C0392B" strokeWidth={2} dot={false} name="Opened" animationDuration={600} />
                <Line type="monotone" dataKey="clicked" stroke="#067647" strokeWidth={2} dot={false} name="Clicked" animationDuration={600} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-24 flex items-center justify-center text-sm text-[#98A2B3] border border-dashed border-[#E4E7EC] rounded-md">
              No published newsletters in this period
            </div>
          )}
        </div>
      </div>
    </div>
  )
}