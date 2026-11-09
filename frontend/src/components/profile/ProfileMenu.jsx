import React, { useState, useRef, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Pencil, LogOut, Settings, ScrollText, ChevronRight } from 'lucide-react'
import { logout } from '../../store/authSlice'
import Avatar from './Avatar'
import ProfilePanel from './ProfilePanel'
import InstituteSettingsPanel from './InstituteSettingsPanel'
import ActivityLogPanel from './ActivityLogPanel'
import usePermissions from '../../hooks/usePermissions'
import { PERMISSIONS } from '../../config/permissions'

const ROLE_LABELS = {
  SUPER_ADMIN: 'Admin',
  COORDINATOR: 'Coordinator',
  FACULTY: 'Faculty',
  GUEST: 'Guest',
}

function Pills({ items }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="px-2 py-0.5 rounded-full bg-[#F5F6F8] text-[#475467] text-[11px] font-medium"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function MenuItem({ icon: Icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="group w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left hover:bg-[#F5F6F8] focus:outline-none focus-visible:bg-[#F5F6F8] transition-colors"
    >
      <span className="w-9 h-9 rounded-lg bg-[#F5F6F8] group-hover:bg-white group-hover:shadow-sm flex items-center justify-center shrink-0 text-[#1B2340] transition-all">
        <Icon size={16} strokeWidth={1.9} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-[#1B2340] leading-tight">{label}</span>
        {hint && <span className="block text-xs text-[#98A2B3] mt-0.5 truncate">{hint}</span>}
      </span>
      <ChevronRight
        size={15}
        className="text-[#D0D5DD] group-hover:text-[#98A2B3] group-hover:translate-x-0.5 transition-all shrink-0"
      />
    </button>
  )
}

export default function ProfileMenu() {
  const user = useSelector((state) => state.auth?.user)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { can } = usePermissions()

  const [menuOpen, setMenuOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const wrapperRef = useRef(null)

  const canManageSettings = can(PERMISSIONS.SETTINGS_MANAGE)
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setMenuOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const openEditor = () => {
    setMenuOpen(false)
    setPanelOpen(true)
  }

  const openSettings = () => {
    setMenuOpen(false)
    setSettingsOpen(true)
  }

  const openActivity = () => {
    setMenuOpen(false)
    setActivityOpen(true)
  }

  const departmentName =
    user?.department && typeof user.department === 'object' ? user.department.name : null
  const clusters = user?.clusters || []
  const sections = user?.sections || []
  const hasContext = departmentName || clusters.length > 0 || sections.length > 0

  return (
    <>
      <div className="relative" ref={wrapperRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2 py-2 pr-1 rounded-md hover:bg-[#F5F6F8] transition-colors"
        >
          <Avatar
            user={user}
            size={32}
            ringClassName="ring-2 ring-[#C0392B]/30 hover:ring-[#C0392B]/60 transition-shadow"
          />
          <span className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium text-[#1B2340]">{user?.firstName || 'Account'}</span>
            {ROLE_LABELS[user?.role] && (
              <span className="text-[11px] text-[#667085]">{ROLE_LABELS[user.role]}</span>
            )}
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-[300px] bg-white border border-[#E4E7EC] rounded-2xl shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)] z-20 overflow-hidden animate-[fadeInUp_0.15s_ease-out]"
          >
            <div className="h-1 bg-gradient-to-r from-[#C0392B] via-[#C9962C] to-[#1B2340]" />

            {/* Who you are */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Avatar user={user} size={48} ringClassName="ring-2 ring-[#F2F4F7]" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-[15px] text-[#1B2340] leading-tight truncate">
                    {user?.firstName} {user?.lastName}
                  </h3>
                  <p className="text-xs text-[#667085] truncate mt-0.5">{user?.email}</p>
                  {ROLE_LABELS[user?.role] && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-[#C9962C]/15 text-[#B07C1F] text-[10px] font-semibold uppercase tracking-wide">
                      {ROLE_LABELS[user.role]}
                    </span>
                  )}
                </div>
              </div>

              {hasContext && (
                <div className="mt-3 pt-3 border-t border-[#F2F4F7] space-y-2">
                  {departmentName && (
                    <p className="text-xs text-[#667085]">
                      <span className="text-[#98A2B3]">Department</span>
                      <span className="block text-sm font-medium text-[#1B2340]">{departmentName}</span>
                    </p>
                  )}
                  {clusters.length > 0 && <Pills items={clusters} />}
                  {sections.length > 0 && <Pills items={sections} />}
                </div>
              )}
            </div>

            {/* What you can do */}
            <div className="px-2 py-2 border-t border-[#F2F4F7] space-y-0.5">
              <MenuItem
                icon={Pencil}
                label="Edit profile"
                hint="Name, photo and phone"
                onClick={openEditor}
              />
              {canManageSettings && (
                <MenuItem
                  icon={Settings}
                  label="Institute settings"
                  hint="Name, contact and newsletter numbering"
                  onClick={openSettings}
                />
              )}
              {isSuperAdmin && (
                <MenuItem
                  icon={ScrollText}
                  label="Activity log"
                  hint="Approvals, publishing and admin changes"
                  onClick={openActivity}
                />
              )}
            </div>

            {/* Leave */}
            <div className="px-2 py-2 border-t border-[#F2F4F7]">
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="group w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left hover:bg-[#FEF3F2] focus:outline-none focus-visible:bg-[#FEF3F2] transition-colors"
              >
                <span className="w-9 h-9 rounded-lg bg-[#F5F6F8] group-hover:bg-white flex items-center justify-center shrink-0 text-[#667085] group-hover:text-[#B42318] transition-colors">
                  <LogOut size={16} strokeWidth={1.9} />
                </span>
                <span className="text-sm font-medium text-[#475467] group-hover:text-[#B42318] transition-colors">
                  Log out
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ProfilePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      {canManageSettings && (
        <InstituteSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}
      {isSuperAdmin && (
        <ActivityLogPanel open={activityOpen} onClose={() => setActivityOpen(false)} />
      )}
    </>
  )
}