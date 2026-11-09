import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import {
  X,
  Camera,
  User,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Bell,
  Eye,
  EyeOff,
  Check,
  Copy,
  Download,
  Mail,
  Phone,
  Loader2,
} from 'lucide-react'
import userService from '../../services/userService'
import authService from '../../services/authService'
import { updateUser, logout } from '../../store/authSlice'
import Avatar from './Avatar'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'password', label: 'Password', icon: Lock },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'preferences', label: 'Preferences', icon: Bell },
]

const ROLE_LABELS = {
  SUPER_ADMIN: 'Admin',
  COORDINATOR: 'Coordinator',
  FACULTY: 'Faculty',
  GUEST: 'Guest',
}

const PREF_ITEMS = [
  { key: 'emailNotifications', label: 'Email notifications', description: 'Receive updates by email' },
  { key: 'pushNotifications', label: 'Push notifications', description: 'Show alerts in the app' },
  { key: 'smsNotifications', label: 'SMS notifications', description: 'Receive urgent updates by text' },
  { key: 'weeklyDigest', label: 'Weekly digest', description: 'One summary email each week' },
]

const DEFAULT_PREFS = {
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  weeklyDigest: true,
}

const MAX_PHOTO_MB = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PHONE_RE = /^\+?[\d\s-]{7,15}$/

const inputBase =
  'w-full py-2.5 rounded-lg border bg-white text-sm text-[#1B2340] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 transition disabled:bg-[#F5F6F8] disabled:text-[#98A2B3] disabled:cursor-not-allowed'
const inputOk = 'border-[#E4E7EC] focus:border-[#C9962C] focus:ring-[#C9962C]/15'
const inputBad = 'border-[#F04438] focus:border-[#F04438] focus:ring-[#F04438]/15'

const primaryBtn =
  'px-4 py-2.5 rounded-lg bg-[#1B2340] text-white text-sm font-medium hover:bg-[#242b52] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
const ghostBtn =
  'px-4 py-2.5 rounded-lg border border-[#E4E7EC] text-sm font-medium text-[#667085] hover:bg-[#F5F6F8] transition-colors'

function getStrength(pw) {
  if (!pw || pw.length < 6) return { score: 0, label: pw ? 'Too short' : '' }
  let score = 1
  if (pw.length >= 10) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score] }
}

const STRENGTH_COLORS = ['#E4E7EC', '#F04438', '#F79009', '#2E90FA', '#12B76A']

function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-[#667085] mb-1.5">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-[#B42318] mt-1">{error}</p>
      ) : (
        hint && <p className="text-[11px] text-[#98A2B3] mt-1">{hint}</p>
      )}
    </div>
  )
}

function IconInput({ icon: Icon, error, className = '', ...props }) {
  return (
    <div className="relative">
      <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
      <input
        {...props}
        className={`${inputBase} pl-9 pr-3 ${error ? inputBad : inputOk} ${className}`}
      />
    </div>
  )
}

function PasswordInput({ id, value, onChange, autoComplete, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`${inputBase} ${inputOk} pl-9 pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#98A2B3] hover:text-[#1B2340] transition-colors"
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1B2340]">{label}</p>
        {description && <p className="text-xs text-[#667085] mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9962C]/50 ${
          checked ? 'bg-[#1B2340]' : 'bg-[#D0D5DD]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function Card({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-[#E4E7EC] p-5">
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-sm font-semibold text-[#1B2340]">{title}</h3>}
          {subtitle && <p className="text-xs text-[#667085] mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

function Pill({ children }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-[#F5F6F8] text-[#1B2340] text-[11px] font-medium">
      {children}
    </span>
  )
}

export default function ProfilePanel({ open, onClose }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth?.user)

  const [tab, setTab] = useState('profile')
  const [askDiscard, setAskDiscard] = useState(false)

  // Profile
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' })
  const [touched, setTouched] = useState({})
  const [saving, setSaving] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoUploading, setPhotoUploading] = useState(false)

  // Password
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')

  // Preferences
  const savedPrefs = useMemo(
    () => ({ ...DEFAULT_PREFS, ...(user?.notificationPreferences || {}) }),
    [user?.notificationPreferences]
  )
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [prefsSaving, setPrefsSaving] = useState(false)

  // 2FA
  const [twoFAStep, setTwoFAStep] = useState('idle') // idle | confirm | backupCodes
  const [qrCode, setQrCode] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [backupCodes, setBackupCodes] = useState([])
  const [disablePassword, setDisablePassword] = useState('')
  const [twoFAError, setTwoFAError] = useState('')
  const [twoFABusy, setTwoFABusy] = useState(false)

  // Sessions
  const [confirmSignOutAll, setConfirmSignOutAll] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Reset everything from the latest user data each time the panel opens.
  useEffect(() => {
    if (!open) return
    setTab('profile')
    setAskDiscard(false)
    setForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    })
    setTouched({})
    setPhotoPreview(null)
    setPw({ currentPassword: '', newPassword: '', confirm: '' })
    setPwError('')
    setPrefs(savedPrefs)
    setTwoFAStep('idle')
    setQrCode('')
    setOtpCode('')
    setBackupCodes([])
    setDisablePassword('')
    setTwoFAError('')
    setConfirmSignOutAll(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ---- Derived state ----
  const profileDirty =
    form.firstName.trim() !== (user?.firstName || '') ||
    form.lastName.trim() !== (user?.lastName || '') ||
    form.phone.trim() !== (user?.phone || '')

  const prefsDirty = PREF_ITEMS.some(({ key }) => !!prefs[key] !== !!savedPrefs[key])

  const errors = {
    firstName: !form.firstName.trim()
      ? 'First name is required.'
      : form.firstName.trim().length > 50
      ? 'Keep it under 50 characters.'
      : '',
    lastName: !form.lastName.trim()
      ? 'Last name is required.'
      : form.lastName.trim().length > 50
      ? 'Keep it under 50 characters.'
      : '',
    phone:
      form.phone.trim() && !PHONE_RE.test(form.phone.trim())
        ? 'Enter a valid phone number (7–15 digits).'
        : '',
  }
  const showError = (field) => (touched[field] ? errors[field] : '')

  const strength = getStrength(pw.newPassword)
  const pwChecks = [
    { label: 'At least 6 characters', ok: pw.newPassword.length >= 6 },
    { label: 'Upper and lowercase letters', ok: /[a-z]/.test(pw.newPassword) && /[A-Z]/.test(pw.newPassword) },
    { label: 'A number', ok: /\d/.test(pw.newPassword) },
    { label: 'A symbol', ok: /[^A-Za-z0-9]/.test(pw.newPassword) },
  ]

  const hasUnsaved = profileDirty || prefsDirty

  const tryClose = () => {
    if (hasUnsaved) setAskDiscard(true)
    else onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && tryClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasUnsaved])

  if (!open) return null

  // ---- Profile handlers ----
  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setTouched({ firstName: true, lastName: true, phone: true })
    if (errors.firstName || errors.lastName || errors.phone) return
    try {
      setSaving(true)
      const response = await userService.updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
      })
      dispatch(updateUser(response.data))
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update profile.')
    } finally {
      setSaving(false)
    }
  }

  const discardProfile = () => {
    setForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    })
    setTouched({})
  }

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Please choose a JPG, PNG or WebP image.')
      return
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      toast.error(`Photo must be under ${MAX_PHOTO_MB} MB.`)
      return
    }
    const preview = URL.createObjectURL(file)
    setPhotoPreview(preview)
    try {
      setPhotoUploading(true)
      const response = await userService.uploadProfilePhoto(file)
      dispatch(updateUser(response.data))
      toast.success('Profile photo updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not upload photo.')
    } finally {
      setPhotoUploading(false)
      setPhotoPreview(null)
      URL.revokeObjectURL(preview)
    }
  }

  // ---- Password handler ----
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPwError('')
    if (pw.newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.')
      return
    }
    if (pw.newPassword !== pw.confirm) {
      setPwError('New password and confirmation do not match.')
      return
    }
    if (pw.newPassword === pw.currentPassword) {
      setPwError('New password must be different from your current one.')
      return
    }
    try {
      setPwSaving(true)
      await authService.changePassword(pw.currentPassword, pw.newPassword)
      toast.success('Password changed')
      setPw({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (err) {
      const message = err.response?.data?.message || 'Could not change password.'
      setPwError(message)
      toast.error(message)
    } finally {
      setPwSaving(false)
    }
  }

  // ---- Preferences handler ----
  const handlePrefsSubmit = async (e) => {
    e.preventDefault()
    try {
      setPrefsSaving(true)
      const response = await userService.updateProfile({ notificationPreferences: prefs })
      dispatch(updateUser(response.data))
      toast.success('Preferences saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save preferences.')
    } finally {
      setPrefsSaving(false)
    }
  }

  // ---- 2FA handlers ----
  const startSetup2FA = async () => {
    setTwoFAError('')
    setTwoFABusy(true)
    try {
      const response = await authService.setup2FA()
      setQrCode(response.data.data.qrCode)
      setTwoFAStep('confirm')
    } catch (err) {
      setTwoFAError(err.response?.data?.message || 'Could not start 2FA setup.')
    } finally {
      setTwoFABusy(false)
    }
  }

  const confirmEnable2FA = async (e) => {
    e.preventDefault()
    setTwoFAError('')
    setTwoFABusy(true)
    try {
      const response = await authService.confirm2FA(otpCode)
      setBackupCodes(response.data.data.backupCodes)
      setTwoFAStep('backupCodes')
      dispatch(updateUser({ twoFactorEnabled: true }))
      setOtpCode('')
      toast.success('2FA enabled')
    } catch (err) {
      const message = err.response?.data?.message || 'Invalid code. Try again.'
      setTwoFAError(message)
      toast.error(message)
    } finally {
      setTwoFABusy(false)
    }
  }

  const handleDisable2FA = async (e) => {
    e.preventDefault()
    setTwoFAError('')
    setTwoFABusy(true)
    try {
      await authService.disable2FA(disablePassword)
      dispatch(updateUser({ twoFactorEnabled: false }))
      setTwoFAStep('idle')
      setDisablePassword('')
      toast.success('2FA disabled')
    } catch (err) {
      const message = err.response?.data?.message || 'Could not disable 2FA.'
      setTwoFAError(message)
      toast.error(message)
    } finally {
      setTwoFABusy(false)
    }
  }

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'))
      toast.success('Backup codes copied')
    } catch {
      toast.error('Could not copy. Select and copy them manually.')
    }
  }

  const downloadCodes = () => {
    const blob = new Blob(
      [`CNMS backup codes for ${user?.email || 'your account'}\n\n${backupCodes.join('\n')}\n`],
      { type: 'text/plain' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cnms-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---- Sessions handler ----
  const handleSignOutAll = async () => {
    if (!confirmSignOutAll) {
      setConfirmSignOutAll(true)
      return
    }
    try {
      setSigningOut(true)
      await authService.logoutAllDevices()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not sign out of all devices.')
      setSigningOut(false)
      setConfirmSignOutAll(false)
      return
    }
    dispatch(logout())
    navigate('/login')
  }

  // ---- Footer config per tab ----
  const footer =
    tab === 'profile'
      ? {
          formId: 'pp-profile-form',
          dirty: profileDirty,
          disabled: saving || !profileDirty,
          saving,
          label: 'Save changes',
          idleText: 'All changes saved',
          onDiscard: discardProfile,
        }
      : tab === 'password'
      ? {
          formId: 'pp-password-form',
          dirty: false,
          disabled: pwSaving || !pw.currentPassword || !pw.newPassword || !pw.confirm,
          saving: pwSaving,
          label: 'Update password',
          idleText: 'Use a password you don’t use elsewhere',
        }
      : tab === 'preferences'
      ? {
          formId: 'pp-prefs-form',
          dirty: prefsDirty,
          disabled: prefsSaving || !prefsDirty,
          saving: prefsSaving,
          label: 'Save preferences',
          idleText: 'All preferences saved',
          onDiscard: () => setPrefs(savedPrefs),
        }
      : null

  const departmentName =
    user?.department && typeof user.department === 'object' ? user.department.name : null
  const clusters = user?.clusters || []
  const sections = user?.sections || []

  return createPortal(
    <>
      <style>{`
        @keyframes panelFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes panelSlide { from { transform: translateX(24px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      `}</style>

      <div
        className="fixed inset-0 z-40 bg-[#1B2340]/40 backdrop-blur-[2px] animate-[panelFade_0.2s_ease-out]"
        onClick={tryClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Edit profile"
        className="fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col animate-[panelSlide_0.25s_ease-out]"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-[#E4E7EC] shrink-0">
          <h2 className="font-serif font-semibold text-lg text-[#1B2340]">Edit profile</h2>
          <button
            type="button"
            onClick={tryClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#667085] hover:bg-[#F5F6F8] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable area */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero */}
          <div>
            <div className="h-24 bg-gradient-to-br from-[#1B2340] via-[#2A2150] to-[#3B2A3F]" />
            <div className="px-6 pb-5">
              <div className="flex items-end gap-4 -mt-10">
                <label className="relative group cursor-pointer shrink-0" title="Change photo">
                  <Avatar user={user} src={photoPreview} size={88} ringClassName="ring-4 ring-white" />
                  <span
                    className={`absolute inset-0 rounded-full bg-black/45 text-white flex items-center justify-center transition-opacity ${
                      photoUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {photoUploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                  </span>
                  <input
                    type="file"
                    accept={ALLOWED_TYPES.join(',')}
                    onChange={handlePhotoSelect}
                    disabled={photoUploading}
                    className="sr-only"
                  />
                </label>
                <div className="pb-1 min-w-0">
                  <h3 className="font-serif font-semibold text-xl text-[#1B2340] leading-tight truncate">
                    {user?.firstName} {user?.lastName}
                  </h3>
                  <p className="text-sm text-[#667085] truncate">{user?.email}</p>
                </div>
              </div>
              <p className="text-[11px] text-[#98A2B3] mt-3">
                Click your photo to change it. JPG, PNG or WebP, up to {MAX_PHOTO_MB} MB.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div
            role="tablist"
            className="sticky top-0 z-10 bg-white border-b border-[#E4E7EC] px-4 flex gap-1 overflow-x-auto"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  tab === id
                    ? 'border-[#C9962C] text-[#1B2340]'
                    : 'border-transparent text-[#667085] hover:text-[#1B2340]'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="px-6 py-6 space-y-5">
            {tab === 'profile' && (
              <>
                <form id="pp-profile-form" onSubmit={handleProfileSubmit} noValidate>
                  <Card title="Personal information" subtitle="This is how you appear across CNMS.">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="First name" htmlFor="pp-first" error={showError('firstName')}>
                          <IconInput
                            icon={User}
                            id="pp-first"
                            value={form.firstName}
                            error={showError('firstName')}
                            autoComplete="given-name"
                            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                            onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
                          />
                        </Field>
                        <Field label="Last name" htmlFor="pp-last" error={showError('lastName')}>
                          <IconInput
                            icon={User}
                            id="pp-last"
                            value={form.lastName}
                            error={showError('lastName')}
                            autoComplete="family-name"
                            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                            onBlur={() => setTouched((t) => ({ ...t, lastName: true }))}
                          />
                        </Field>
                      </div>

                      <Field label="Phone" htmlFor="pp-phone" error={showError('phone')}>
                        <IconInput
                          icon={Phone}
                          id="pp-phone"
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={form.phone}
                          error={showError('phone')}
                          autoComplete="tel"
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                        />
                      </Field>

                      <Field
                        label="Email"
                        htmlFor="pp-email"
                        hint="Email can’t be changed here. Contact an admin if it needs updating."
                      >
                        <IconInput icon={Mail} id="pp-email" value={user?.email || ''} disabled readOnly />
                      </Field>
                    </div>
                  </Card>
                </form>

                <Card title="Account details" subtitle="Assigned by an administrator.">
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.15em] text-[#98A2B3] font-semibold mb-1">
                        Role
                      </dt>
                      <dd>
                        <span className="px-2 py-0.5 rounded-full bg-[#C9962C]/15 text-[#B07C1F] text-[11px] font-semibold uppercase tracking-wide">
                          {ROLE_LABELS[user?.role] || user?.role || '—'}
                        </span>
                      </dd>
                    </div>
                    {departmentName && (
                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.15em] text-[#98A2B3] font-semibold mb-1">
                          Department
                        </dt>
                        <dd className="text-sm text-[#1B2340]">{departmentName}</dd>
                      </div>
                    )}
                    {clusters.length > 0 && (
                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.15em] text-[#98A2B3] font-semibold mb-1.5">
                          Clusters
                        </dt>
                        <dd className="flex flex-wrap gap-1.5">
                          {clusters.map((c) => (
                            <Pill key={c}>{c}</Pill>
                          ))}
                        </dd>
                      </div>
                    )}
                    {sections.length > 0 && (
                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.15em] text-[#98A2B3] font-semibold mb-1.5">
                          Sections
                        </dt>
                        <dd className="flex flex-wrap gap-1.5">
                          {sections.map((s) => (
                            <Pill key={s}>{s}</Pill>
                          ))}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Card>
              </>
            )}

            {tab === 'password' && (
              <form id="pp-password-form" onSubmit={handlePasswordSubmit} noValidate>
                <Card title="Change password" subtitle="You may need to log in again on your other devices.">
                  <div className="space-y-4">
                    <Field label="Current password" htmlFor="pp-current">
                      <PasswordInput
                        id="pp-current"
                        autoComplete="current-password"
                        value={pw.currentPassword}
                        onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
                      />
                    </Field>

                    <Field label="New password" htmlFor="pp-new">
                      <PasswordInput
                        id="pp-new"
                        autoComplete="new-password"
                        value={pw.newPassword}
                        onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
                      />
                    </Field>

                    {pw.newPassword && (
                      <div>
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4].map((i) => (
                            <span
                              key={i}
                              className="h-1.5 flex-1 rounded-full transition-colors"
                              style={{
                                backgroundColor: i <= strength.score ? STRENGTH_COLORS[strength.score] : '#E4E7EC',
                              }}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] mt-1.5" style={{ color: STRENGTH_COLORS[strength.score] }}>
                          {strength.label}
                        </p>
                        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                          {pwChecks.map((c) => (
                            <li
                              key={c.label}
                              className={`flex items-center gap-1.5 text-[11px] ${
                                c.ok ? 'text-[#067647]' : 'text-[#98A2B3]'
                              }`}
                            >
                              <Check size={12} className={c.ok ? 'opacity-100' : 'opacity-30'} />
                              {c.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Field label="Confirm new password" htmlFor="pp-confirm">
                      <PasswordInput
                        id="pp-confirm"
                        autoComplete="new-password"
                        value={pw.confirm}
                        onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                      />
                    </Field>
                    {pw.confirm && (
                      <p
                        className={`text-[11px] -mt-2 ${
                          pw.confirm === pw.newPassword ? 'text-[#067647]' : 'text-[#B42318]'
                        }`}
                      >
                        {pw.confirm === pw.newPassword ? 'Passwords match' : 'Passwords do not match'}
                      </p>
                    )}

                    {pwError && (
                      <p className="text-sm text-[#B42318] bg-[#FEF3F2] border border-[#FECDCA] rounded-lg px-3 py-2">
                        {pwError}
                      </p>
                    )}
                  </div>
                </Card>
              </form>
            )}

            {tab === 'security' && (
              <>
                <Card>
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        user?.twoFactorEnabled ? 'bg-[#ECFDF3] text-[#067647]' : 'bg-[#FFFAEB] text-[#B54708]'
                      }`}
                    >
                      {user?.twoFactorEnabled ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#1B2340]">Two-factor authentication</h3>
                      <p className="text-xs text-[#667085] mt-0.5">
                        {user?.twoFactorEnabled
                          ? 'On. A code from your authenticator app is required at login.'
                          : 'Off. Add a second step to protect your account.'}
                      </p>
                    </div>
                  </div>

                  {twoFAError && (
                    <p className="mt-4 text-sm text-[#B42318] bg-[#FEF3F2] border border-[#FECDCA] rounded-lg px-3 py-2">
                      {twoFAError}
                    </p>
                  )}

                  {twoFAStep === 'idle' && !user?.twoFactorEnabled && (
                    <button
                      type="button"
                      disabled={twoFABusy}
                      onClick={startSetup2FA}
                      className={`${primaryBtn} mt-4`}
                    >
                      {twoFABusy ? 'Starting…' : 'Enable 2FA'}
                    </button>
                  )}

                  {twoFAStep === 'confirm' && (
                    <form onSubmit={confirmEnable2FA} className="mt-5 space-y-4">
                      <ol className="flex items-center gap-2 text-[11px] font-medium">
                        <li className="flex items-center gap-1.5 text-[#1B2340]">
                          <span className="w-5 h-5 rounded-full bg-[#1B2340] text-white flex items-center justify-center">
                            1
                          </span>
                          Scan &amp; verify
                        </li>
                        <span className="flex-1 h-px bg-[#E4E7EC]" />
                        <li className="flex items-center gap-1.5 text-[#98A2B3]">
                          <span className="w-5 h-5 rounded-full bg-[#F2F4F7] flex items-center justify-center">
                            2
                          </span>
                          Save backup codes
                        </li>
                      </ol>

                      {qrCode && (
                        <img
                          src={qrCode}
                          alt="2FA QR code"
                          className="w-40 h-40 rounded-lg border border-[#E4E7EC] p-2"
                        />
                      )}
                      <p className="text-sm text-[#667085]">
                        Scan this with your authenticator app, then enter the 6-digit code it shows.
                      </p>
                      <input
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        aria-label="6-digit code"
                        className={`${inputBase} ${inputOk} px-3 w-44 text-center font-mono text-lg tracking-[0.4em]`}
                      />
                      <div className="flex gap-2">
                        <button type="submit" disabled={twoFABusy || otpCode.length < 6} className={primaryBtn}>
                          {twoFABusy ? 'Verifying…' : 'Verify & enable'}
                        </button>
                        <button
                          type="button"
                          className={ghostBtn}
                          onClick={() => {
                            setTwoFAStep('idle')
                            setOtpCode('')
                            setTwoFAError('')
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {twoFAStep === 'backupCodes' && (
                    <div className="mt-5 space-y-4">
                      <ol className="flex items-center gap-2 text-[11px] font-medium">
                        <li className="flex items-center gap-1.5 text-[#067647]">
                          <span className="w-5 h-5 rounded-full bg-[#067647] text-white flex items-center justify-center">
                            <Check size={12} />
                          </span>
                          Scan &amp; verify
                        </li>
                        <span className="flex-1 h-px bg-[#E4E7EC]" />
                        <li className="flex items-center gap-1.5 text-[#1B2340]">
                          <span className="w-5 h-5 rounded-full bg-[#1B2340] text-white flex items-center justify-center">
                            2
                          </span>
                          Save backup codes
                        </li>
                      </ol>
                      <p className="text-sm text-[#667085]">
                        Save these codes somewhere safe. Each one works once if you lose access to your
                        authenticator app.
                      </p>
                      <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-[#F5F6F8] rounded-lg p-4">
                        {backupCodes.map((code) => (
                          <span key={code}>{code}</span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={copyCodes} className={`${ghostBtn} inline-flex items-center gap-2`}>
                          <Copy size={14} /> Copy
                        </button>
                        <button
                          type="button"
                          onClick={downloadCodes}
                          className={`${ghostBtn} inline-flex items-center gap-2`}
                        >
                          <Download size={14} /> Download
                        </button>
                        <button type="button" onClick={() => setTwoFAStep('idle')} className={primaryBtn}>
                          I’ve saved them
                        </button>
                      </div>
                    </div>
                  )}

                  {twoFAStep === 'idle' && user?.twoFactorEnabled && (
                    <form onSubmit={handleDisable2FA} className="mt-5 space-y-3">
                      <Field
                        label="Confirm your password to turn off 2FA"
                        htmlFor="pp-disable-2fa"
                      >
                        <PasswordInput
                          id="pp-disable-2fa"
                          autoComplete="current-password"
                          value={disablePassword}
                          onChange={(e) => setDisablePassword(e.target.value)}
                        />
                      </Field>
                      <button
                        type="submit"
                        disabled={twoFABusy || !disablePassword}
                        className="px-4 py-2.5 rounded-lg border border-[#FECDCA] text-[#B42318] text-sm font-medium hover:bg-[#FEF3F2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {twoFABusy ? 'Turning off…' : 'Turn off 2FA'}
                      </button>
                    </form>
                  )}
                </Card>

                <Card title="Sessions" subtitle="Signed in somewhere you don’t recognise? End all sessions.">
                  <button
                    type="button"
                    onClick={handleSignOutAll}
                    disabled={signingOut}
                    className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40 ${
                      confirmSignOutAll
                        ? 'border-[#B42318] bg-[#B42318] text-white hover:bg-[#912018]'
                        : 'border-[#E4E7EC] text-[#1B2340] hover:bg-[#F5F6F8]'
                    }`}
                  >
                    {signingOut
                      ? 'Signing out…'
                      : confirmSignOutAll
                      ? 'Click again to confirm'
                      : 'Sign out of all devices'}
                  </button>
                  {confirmSignOutAll && !signingOut && (
                    <button
                      type="button"
                      onClick={() => setConfirmSignOutAll(false)}
                      className="ml-3 text-sm text-[#667085] hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </Card>
              </>
            )}

            {tab === 'preferences' && (
              <form id="pp-prefs-form" onSubmit={handlePrefsSubmit}>
                <Card title="Notifications" subtitle="Choose how you want to hear from CNMS.">
                  <div className="divide-y divide-[#F2F4F7] -my-1">
                    {PREF_ITEMS.map(({ key, label, description }) => (
                      <Toggle
                        key={key}
                        label={label}
                        description={description}
                        checked={!!prefs[key]}
                        onChange={() => setPrefs({ ...prefs, [key]: !prefs[key] })}
                      />
                    ))}
                  </div>
                </Card>
              </form>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        {footer && (
          <div className="shrink-0 border-t border-[#E4E7EC] bg-white px-6 py-4">
            {askDiscard ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[#1B2340] font-medium">Discard unsaved changes?</p>
                <div className="flex gap-2">
                  <button type="button" className={ghostBtn} onClick={() => setAskDiscard(false)}>
                    Keep editing
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-lg bg-[#B42318] text-white text-sm font-medium hover:bg-[#912018] transition-colors"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[#667085] flex items-center gap-2 min-w-0">
                  {footer.dirty ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C9962C] shrink-0" />
                      Unsaved changes
                    </>
                  ) : (
                    <span className="truncate">{footer.idleText}</span>
                  )}
                </p>
                <div className="flex gap-2 shrink-0">
                  {footer.onDiscard && footer.dirty && (
                    <button type="button" className={ghostBtn} onClick={footer.onDiscard}>
                      Discard
                    </button>
                  )}
                  <button type="submit" form={footer.formId} disabled={footer.disabled} className={primaryBtn}>
                    {footer.saving ? 'Saving…' : footer.label}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Discard prompt for tabs without a footer (e.g. Security) */}
        {!footer && askDiscard && (
          <div className="shrink-0 border-t border-[#E4E7EC] bg-white px-6 py-4 flex items-center justify-between gap-3">
            <p className="text-sm text-[#1B2340] font-medium">Discard unsaved changes?</p>
            <div className="flex gap-2">
              <button type="button" className={ghostBtn} onClick={() => setAskDiscard(false)}>
                Keep editing
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg bg-[#B42318] text-white text-sm font-medium hover:bg-[#912018] transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </aside>
    </>,
    document.body
  )
}