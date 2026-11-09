import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const TILES = [
  { key: 'total', label: 'Total', bg: 'bg-[#F5F6F8]', text: 'text-[#1B2340]', label_text: 'text-[#667085]', icon: '📅' },
  { key: 'approved', label: 'Approved', bg: 'bg-[#ECFDF3]', text: 'text-[#067647]', label_text: 'text-[#067647]', icon: '✅' },
  { key: 'pending', label: 'Pending', bg: 'bg-[#FBF3E7]', text: 'text-[#B07C1F]', label_text: 'text-[#B07C1F]', icon: '⏳' },
  { key: 'rejected', label: 'Rejected', bg: 'bg-[#FEF3F2]', text: 'text-[#B42318]', label_text: 'text-[#B42318]', icon: '✕' },
]

export default function EventStats({ data = {} }) {
  const byTypeData = data.byType
    ? Object.entries(data.byType).map(([type, count]) => ({ type, count }))
    : []

  const total = data.total || 0
  const approvalRate = total > 0 ? Math.round(((data.approved || 0) / total) * 100) : 0

  return (
    <div className="bg-white border border-[#E4E7EC] rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-1 bg-gradient-to-r from-[#C0392B] to-[#E05C4D]" />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif font-semibold text-lg text-[#1B2340]">Events</h2>
          <span className="text-xs font-medium text-[#667085] bg-[#F5F6F8] rounded-full px-2.5 py-1">
            {total} total
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {TILES.map((tile) => (
            <div
              key={tile.key}
              className={`${tile.bg} rounded-md p-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-sm`}
            >
              <p className={`text-[10px] uppercase tracking-wide ${tile.label_text} font-semibold mb-1 flex items-center gap-1`}>
                <span aria-hidden="true">{tile.icon}</span> {tile.label}
              </p>
              <p className={`text-xl font-serif font-semibold ${tile.text}`}>{data[tile.key] || 0}</p>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.15em] text-[#667085] font-semibold mb-3">
            Events by Type
          </p>
          {byTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byTypeData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="type"
                  tick={{ fontSize: 11, fill: '#667085' }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  cursor={{ fill: '#F5F6F8' }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }}
                />
                <Bar dataKey="count" fill="#C0392B" radius={[0, 4, 4, 0]} maxBarSize={22} animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-24 flex items-center justify-center text-sm text-[#98A2B3] border border-dashed border-[#E4E7EC] rounded-md">
              No event types recorded yet
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-[0.15em] text-[#667085] font-semibold">
              Approval Rate
            </p>
            <p className="text-xs font-semibold text-[#1B2340]">{approvalRate}%</p>
          </div>
          <div className="h-2 bg-[#F2F4F7] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#C0392B] to-[#E05C4D] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${approvalRate}%` }}
            />
          </div>
          <p className="text-xs text-[#667085] mt-1.5">
            {total > 0 ? `${approvalRate}% of events approved` : 'No events yet'}
          </p>
        </div>
      </div>
    </div>
  )
}