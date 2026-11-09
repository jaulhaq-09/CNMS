import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function UserActivityChart({ data = [] }) {
  const totalActivities = data.reduce(
    (sum, d) => sum + (d.events || 0) + (d.newsletters || 0) + (d.templates || 0),
    0
  )
  const totalActiveUsers = data.reduce((sum, d) => sum + (d.users || 0), 0)
  const hasActivity = totalActivities > 0 || totalActiveUsers > 0

  return (
    <div className="bg-white border border-[#E4E7EC] rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-1 bg-gradient-to-r from-[#C0392B] via-[#1B2340] to-[#3B2A3F]" />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif font-semibold text-lg text-[#1B2340]">Activity Overview</h2>
        </div>

        {data.length > 0 && hasActivity ? (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#F5F6F8' }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="events" fill="#1B2340" name="Events" radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={600} />
                <Bar dataKey="newsletters" fill="#C0392B" name="Newsletters" radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={600} />
                <Bar dataKey="templates" fill="#667085" name="Templates" radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={600} />
                <Bar dataKey="users" fill="#067647" name="Active Users" radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-[#F5F6F8] rounded-md p-3 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-sm">
                <p className="text-[10px] uppercase tracking-wide text-[#667085] font-semibold mb-1">
                  Total Activities
                </p>
                <p className="text-xl font-serif font-semibold text-[#1B2340]">{totalActivities}</p>
              </div>
              <div className="bg-[#F5F6F8] rounded-md p-3 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-sm">
                <p className="text-[10px] uppercase tracking-wide text-[#667085] font-semibold mb-1">
                  Active Users
                </p>
                <p className="text-xl font-serif font-semibold text-[#1B2340]">{totalActiveUsers}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="h-32 flex flex-col items-center justify-center text-sm text-[#98A2B3] border border-dashed border-[#E4E7EC] rounded-md">
            <span className="text-2xl mb-2">📊</span>
            No activity recorded in this period
          </div>
        )}
      </div>
    </div>
  )
}