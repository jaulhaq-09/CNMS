import React, { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import SearchModal from '../components/search/SearchModal'
import usePermissions from '../hooks/usePermissions'
import { PERMISSIONS } from '../config/permissions'
import { Outlet, useLocation } from 'react-router-dom'
import NotificationWidget from '../components/NotificationWidget'
import Sidebar from '../components/common/Sidebar'
import { formatDateLong } from '../utils/date'
import ProfileMenu from '../components/profile/ProfileMenu'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/search': 'Search',
  '/analytics': 'Analytics',
  '/templates': 'Templates',
  '/export': 'Export',
  '/reports': 'Reports',
  '/post': 'Post',
  '/post-event': 'Post Event',
  '/approvals': 'Approvals',
  '/newsletters': 'Newsletters',
  '/admin/users': 'Users',
  '/admin/settings': 'Settings',
  '/post-publication': 'Submit Publication',
  '/publications': 'Publications',
  '/nptel-courses': 'NPTEL Courses',
  '/post-achievement': 'Submit Achievement',
  '/post-patent': 'Submit Patent',
}

export default function DashboardLayout() {
  const location = useLocation()
  const { can } = usePermissions()
  const [searchOpen, setSearchOpen] = useState(false)
  const canSearch = can(PERMISSIONS.SEARCH_VIEW)

  useEffect(() => {
    if (!canSearch) return
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [canSearch])

  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard'

  return (
    <div className="h-screen bg-gradient-to-br from-[#F5F6F8] via-[#FBEEEC] to-[#F0F3FA] flex overflow-hidden">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <Sidebar />
      {canSearch && <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Top bar */}
        <header className="bg-white/90 backdrop-blur-sm border-b border-[#E4E7EC] h-16 flex items-center gap-6 px-6 shadow-sm shrink-0 z-10">
          <div className="shrink-0 flex items-center gap-3">
            <div className="w-1 h-9 rounded-full bg-gradient-to-b from-[#C0392B] to-[#E05C4D]" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#C0392B] font-semibold leading-none">
                {formatDateLong()}
              </p>
              <h1 className="font-serif font-semibold text-lg text-[#1B2340] mt-0.5">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto shrink-0">
            {canSearch && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                title="Search (Ctrl+K)"
                aria-label="Search"
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#667085] hover:bg-[#F5F6F8] transition-colors"
              >
                <Search size={18} strokeWidth={1.8} />
              </button>
            )}
            <NotificationWidget />

            <div className="w-px h-6 bg-[#E4E7EC]" />
            <ProfileMenu />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}