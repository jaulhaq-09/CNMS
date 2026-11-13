import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  CalendarPlus,
  CheckSquare,
  Newspaper,
  Building2,
  Users,
  BookOpen,
  Library,
  GraduationCap,
  Award,
  Lightbulb,
} from 'lucide-react'
import usePermissions from '../../hooks/usePermissions'
import { PERMISSIONS } from '../../config/permissions'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true, permission: PERMISSIONS.DASHBOARD_VIEW },
  { to: '/templates', label: 'Templates', icon: FileText, permission: PERMISSIONS.TEMPLATES_VIEW },
  { to: '/reports', label: 'Reports', icon: ClipboardList, permission: PERMISSIONS.REPORTS_VIEW },
  { to: '/post', label: 'Activities', icon: CalendarPlus, permission: PERMISSIONS.EVENTS_CREATE },
  { to: '/approvals', label: 'Approvals', icon: CheckSquare, permission: PERMISSIONS.EVENTS_APPROVE },
  { to: '/newsletters', label: 'Newsletters', icon: Newspaper, permission: PERMISSIONS.NEWSLETTER_GENERATE },
  { to: '/admin/departments', label: 'Departments', icon: Building2, permission: PERMISSIONS.DEPARTMENTS_MANAGE },
  { to: '/admin/users', label: 'Users', icon: Users, permission: PERMISSIONS.USERS_MANAGE },
  { to: '/post-publication', label: 'Publication', icon: BookOpen, permission: PERMISSIONS.EVENTS_CREATE },
  { to: '/nptel-courses', label: 'NPTEL Courses', icon: GraduationCap, permission: PERMISSIONS.EVENTS_CREATE },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { can } = usePermissions()
  const currentUser = useSelector((state) => state.auth?.user)
  const isAdmin = currentUser?.role === 'SUPER_ADMIN'
  const isCoordinator = currentUser?.role === 'COORDINATOR'
  const isFaculty = currentUser?.role === 'FACULTY'
  const usesGoldAccent = isAdmin || isCoordinator || isFaculty

  // Admin oversees the system and does not submit activities, publications, courses, or approve cluster events
  const ADMIN_HIDDEN_PATHS = ['/post', '/approvals', '/post-publication', '/nptel-courses']

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!can(item.permission)) return false
    if (isAdmin && ADMIN_HIDDEN_PATHS.includes(item.to)) return false
    return true
  })

  return (
    <>
      <style>{`
        .sidebar-nav-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(201, 150, 44, 0.35) transparent;
        }
        .sidebar-nav-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .sidebar-nav-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(201, 150, 44, 0.35);
          border-radius: 999px;
        }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(201, 150, 44, 0.6);
        }
      `}</style>
      <aside
        className={`shrink-0 relative overflow-hidden bg-gradient-to-b from-[#1B2340] via-[#1F1938] to-[#241C42] text-white h-screen flex flex-col transition-[width] duration-200 ${collapsed ? 'w-[76px]' : 'w-64'
          }`}
      >
        {/* Subtle ambient glow, matches homepage/login branding */}
        <div className={`absolute -top-20 -left-20 w-64 h-64 rounded-full blur-3xl pointer-events-none ${usesGoldAccent ? 'bg-[#C9962C]/10' : 'bg-[#C0392B]/10'}`} />
        <div className={`absolute bottom-0 -right-16 w-56 h-56 rounded-full blur-3xl pointer-events-none ${usesGoldAccent ? 'bg-[#C9962C]/5' : 'bg-[#C0392B]/5'}`} />
        {/* Brand */}
        <div className={`relative z-10 flex items-center gap-3 h-16 border-b border-white/10 ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
          <span className={`font-serif font-semibold text-xl tracking-wide bg-clip-text text-transparent ${usesGoldAccent ? 'bg-gradient-to-r from-white to-[#E0B563]' : 'bg-gradient-to-r from-white to-[#F0A8A0]'}`}>
            CNMS
          </span>
          {!collapsed && (
            <span className={`text-[10px] uppercase tracking-[0.15em] border-l border-white/20 pl-3 ${usesGoldAccent ? 'text-[#E0B563]' : 'text-[#C0392B]/90'}`}>
              Est. 2026
            </span>
          )}
        </div>

        {/* Nav */}
        <div className="relative flex-1 min-h-0">
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#1B2340] to-transparent z-20" />
          <nav className="sidebar-nav-scroll relative z-10 h-full overflow-y-auto px-3 py-4 space-y-1">
            {visibleItems.map((item) => {
              const label = isFaculty && item.to === '/post'
                ? 'Monthly Report'
                : isFaculty && item.to === '/post-publication'
                  ? 'Publications'
                  : isFaculty && item.to === '/nptel-courses'
                    ? 'Courses & Certifications'
                    : item.label
              return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium border-l-[3px] transition-all duration-200 ${collapsed ? 'justify-center' : ''
                  } ${isActive
                    ? usesGoldAccent
                      ? 'border-[#C9962C] bg-gradient-to-r from-[#C9962C]/20 to-transparent text-[#E0B563] shadow-[0_0_20px_-8px_rgba(201,150,44,0.45)]'
                      : 'border-[#C0392B] bg-gradient-to-r from-[#C0392B]/15 to-transparent text-[#F0A8A0] shadow-[0_0_20px_-8px_rgba(192,57,43,0.5)]'
                    : 'border-transparent text-white/70 hover:text-white hover:bg-white/5 hover:translate-x-0.5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-all duration-200 ${isActive
                        ? usesGoldAccent
                          ? 'bg-gradient-to-br from-[#C9962C] to-[#E0B563] text-[#1B2340]'
                          : 'bg-gradient-to-br from-[#C0392B] to-[#E05C4D] text-white'
                        : 'bg-white/10 text-white'
                        }`}
                    >
                      <item.icon size={15} strokeWidth={2} />
                    </span>
                    {!collapsed && <span>{label}</span>}
                  </>
                )}
              </NavLink>
            )})}
          </nav>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#241C42] to-transparent z-20" />
        </div>

        {/* Collapse toggle */}
        <div className="relative z-10 px-3 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs text-white/55 border border-white/10 hover:bg-white/5 hover:text-white transition-all ${usesGoldAccent ? 'hover:border-[#C9962C]/40' : 'hover:border-[#C0392B]/30'}`}
          >
            <span className="text-sm leading-none">{collapsed ? '»' : '«'}</span>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  )
}