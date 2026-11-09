import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  ArrowRight,
  Sparkles,
  BookOpen,
  Award,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Users,
  Layers,
  Send,
  RotateCcw,
  Building2,
  ExternalLink,
  ChevronRight,
  GraduationCap,
  Check,
  FileSpreadsheet,
  BarChart3,
  Flame,
  Zap,
  ChevronDown,
  Compass,
  BookmarkCheck,
  CheckCircle
} from 'lucide-react'

import collegeLogo from '../assets/college-logo.jpg'
import campusBg from '../assets/college-campus-bg.jpg'

const ROLE_CARDS = [
  {
    role: 'FACULTY',
    title: 'Faculty Members',
    badge: 'Submit & Track',
    badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    headerGradient: 'from-indigo-900/60 via-indigo-950/40 to-slate-900/80',
    iconBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
    icon: GraduationCap,
    description:
      'Log research papers, patent filings, NPTEL / Udemy certifications, and departmental events with complete citation records.',
    highlights: [
      'Research papers with Scopus / WoS DOI indexing',
      'NPTEL, Swayam, Coursera & Udemy certifications',
      'Continuous auto-save ensures zero progress loss',
      'Direct revision notes and comments from coordinators'
    ],
    actionText: 'Faculty Submissions',
    actionLink: '/login',
    accentColor: '#6366F1'
  },
  {
    role: 'COORDINATOR',
    title: 'Cluster Coordinators',
    badge: 'Curate & Review',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    headerGradient: 'from-amber-900/50 via-amber-950/30 to-slate-900/80',
    iconBg: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    icon: Layers,
    description:
      'Review faculty submissions, offer editorial suggestions with structured comments, and assemble approved items into a standard cluster report.',
    highlights: [
      'Interactive approval workspace with inline edits',
      'Return submissions with actionable revision notes',
      'Admin-fixed standardized cluster report layout',
      'One-click forwarding directly to central administration'
    ],
    actionText: 'Coordinator Desk',
    actionLink: '/login',
    accentColor: '#F59E0B'
  },
  {
    role: 'ADMIN',
    title: 'Central Administration',
    badge: 'Consolidate & Publish',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    headerGradient: 'from-emerald-900/50 via-emerald-950/30 to-slate-900/80',
    iconBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    icon: ShieldCheck,
    description:
      'Manage faculty rosters, assign user roles with one click, and consolidate all departmental cluster reports into the master institute newsletter.',
    highlights: [
      'Bulk Excel faculty roster import & role assignments',
      'Clean 3-role governance (Admin, Coordinator, Faculty)',
      'Multi-cluster consolidation into the master publication',
      'High-impact PDF publication and institutional archiving'
    ],
    actionText: 'Admin Governance',
    actionLink: '/login',
    accentColor: '#10B981'
  }
]

const WORKFLOW_STEPS = [
  {
    step: '01',
    role: 'Faculty',
    roleColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    title: 'Submit & Auto-Save',
    desc: 'Faculty enter research publications, certifications, and event milestones. Built-in draft autosave ensures unsubmitted work persists safely across sessions.',
    icon: FileText
  },
  {
    step: '02',
    role: 'Coordinator',
    roleColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    title: 'Review & Curate',
    desc: 'Cluster coordinators review submissions. If revisions are required, coordinators return items with detailed feedback notes so faculty can refine and resubmit.',
    icon: RotateCcw
  },
  {
    step: '03',
    role: 'Admin',
    roleColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    title: 'Consolidate Reports',
    desc: 'Central administration collects standard cluster reports from all coordinators, reviews the aggregated institute accomplishments, and formats the master report.',
    icon: Layers
  },
  {
    step: '04',
    role: 'Campus',
    roleColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    title: 'Master Publication',
    desc: 'The official institute newsletter is compiled, reviewed, archived, and distributed across campus and academic stakeholders with full citation records.',
    icon: Sparkles
  }
]

const KEY_FEATURES = [
  {
    icon: Zap,
    title: 'Work-in-Progress Draft Saving',
    desc: 'Log out or leave midway without worry. All faculty and coordinator forms preserve your in-progress work automatically.',
    tag: 'Continuous Autosave',
    tagClass: 'text-amber-600 bg-amber-50'
  },
  {
    icon: Award,
    title: 'Multi-Platform Course Tracking',
    desc: 'Track faculty growth across NPTEL, SWAYAM, Udemy, Coursera, Google Cloud, and custom providers with certificate attachments.',
    tag: 'Certifications',
    tagClass: 'text-indigo-600 bg-indigo-50'
  },
  {
    icon: BookOpen,
    title: 'Scopus & WoS Research Registry',
    desc: 'Comprehensive bibliographic indexing including DOI, publication quartile, conference tier, and journal metrics.',
    tag: 'Publications',
    tagClass: 'text-emerald-600 bg-emerald-50'
  },
  {
    icon: Send,
    title: 'Two-Way Revision Feedback Loop',
    desc: 'Coordinators resend activities with actionable notes. Faculty see the remarks directly on their dashboard and resubmit with ease.',
    tag: 'Editorial Control',
    tagClass: 'text-purple-600 bg-purple-50'
  },
  {
    icon: FileSpreadsheet,
    title: 'Standardized Report Framework',
    desc: 'Uniform layout fixed by the administration ensures zero manual reformatting when merging cluster submissions.',
    tag: 'Format Standardization',
    tagClass: 'text-rose-600 bg-rose-50'
  },
  {
    icon: Users,
    title: 'Clean 3-Role Governance',
    desc: 'Streamlined role system strictly organized around Admin, Coordinator, and Faculty for swift user management and access control.',
    tag: 'Role Security',
    tagClass: 'text-blue-600 bg-blue-50'
  }
]

const IMPORTANT_LINKS = [
  { label: 'Latest Newsletter Releases', to: '/newsletters' },
  { label: 'Research Publications Directory', to: '/publications' },
  { label: 'NPTEL & Development Courses', to: '/nptel-courses' },
  { label: 'Campus Activity Dashboard', to: '/dashboard' }
]

export default function HomePage() {
  const auth = useSelector((state) => state.auth)
  const isAuthenticated = Boolean(auth?.isAuthenticated)
  const currentUser = auth?.user
  const [linksOpen, setLinksOpen] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = () => setLinksOpen(false)
    if (linksOpen) {
      window.addEventListener('click', handleOutside)
    }
    return () => window.removeEventListener('click', handleOutside)
  }, [linksOpen])

  return (
    <div id="top" className="min-h-screen bg-[#FDFBF7] text-[#1E293B] font-sans selection:bg-[#C9962C]/30 selection:text-[#1B2340]">
      {/* Visual Animation Styles */}
      <style>{`
        @keyframes subtleFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.08); }
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .float-animation {
          animation: subtleFloat 6s ease-in-out infinite;
        }
        .glow-animation {
          animation: pulseGlow 8s ease-in-out infinite;
        }
        .marquee-track {
          animation: marquee 26s linear infinite;
        }
        .shimmer-btn {
          background-size: 200% auto;
          transition: 0.5s;
        }
        .shimmer-btn:hover {
          background-position: right center;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track, .float-animation, .glow-animation { animation: none; }
        }
      `}</style>

      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 bg-[#0F1424]/90 backdrop-blur-md border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand & Crest */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="relative">
              <img
                src={collegeLogo}
                alt="BMSIT Crest"
                className="h-12 w-12 rounded-full object-cover ring-2 ring-[#C9962C]/60 group-hover:ring-[#C9962C] transition-all shadow-md"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0F1424]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-white text-lg tracking-wide group-hover:text-amber-200 transition-colors">
                  BMSIT &amp; Management
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#C9962C]/20 text-[#E0B563] border border-[#C9962C]/30 uppercase tracking-wider">
                  CNMS
                </span>
              </div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#C9962C] font-medium">
                College Newsletter Management System
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a href="#workflow" className="hover:text-amber-300 transition-colors">
              Workflow
            </a>
            <a href="#roles" className="hover:text-amber-300 transition-colors">
              Roles
            </a>
            <a href="#features" className="hover:text-amber-300 transition-colors">
              Features
            </a>
            <Link to="/publications" className="hover:text-amber-300 transition-colors">
              Publications
            </Link>

            {/* Important Links Dropdown */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setLinksOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-white/5 hover:text-white transition-all text-slate-300"
              >
                <span>Quick Access</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${linksOpen ? 'rotate-180 text-amber-400' : ''}`} />
              </button>

              {linksOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#182138] rounded-xl shadow-2xl border border-white/10 p-2 z-50 animate-[fadeInUp_0.15s_ease-out]">
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Campus Portals &amp; Records
                  </p>
                  {IMPORTANT_LINKS.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setLinksOpen(false)}
                      className="flex items-center justify-between px-3 py-2 text-xs text-slate-200 rounded-lg hover:bg-white/10 hover:text-amber-300 transition-colors"
                    >
                      <span>{link.label}</span>
                      <ChevronRight size={12} className="text-slate-400" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Action Button */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-white">
                    {currentUser?.username || currentUser?.email || 'Logged in'}
                  </span>
                  <span className="text-[10px] uppercase text-[#E0B563]">({currentUser?.role || 'User'})</span>
                </span>
                <Link
                  to="/dashboard"
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#0F1424] font-semibold text-sm hover:brightness-110 shadow-lg hover:shadow-[#C9962C]/20 transition-all flex items-center gap-2 group"
                >
                  <span>Dashboard</span>
                  <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/login"
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#C9962C] via-[#E0B563] to-[#D4A340] text-[#0F1424] font-semibold text-sm hover:brightness-110 shadow-lg hover:shadow-amber-500/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                  <span>Sign In</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden min-h-[88vh] flex flex-col justify-center">
        {/* Campus Background Image with Deep Academic Scrim */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed scale-105"
          style={{ backgroundImage: `url(${campusBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A0D18]/95 via-[#121626]/90 to-[#1F1932]/92" />

        {/* Ambient Glowing Radial Orbs */}
        <div className="absolute top-10 right-10 w-96 h-96 bg-[#C9962C]/20 rounded-full blur-[110px] glow-animation pointer-events-none" />
        <div
          className="absolute bottom-10 left-10 w-[28rem] h-[28rem] bg-indigo-600/20 rounded-full blur-[120px] glow-animation pointer-events-none"
          style={{ animationDelay: '3s' }}
        />

        {/* Hero Content */}
        <div className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center flex flex-col items-center">
          {/* Live Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-amber-200 font-medium mb-8 shadow-inner float-animation">
            <Sparkles size={14} className="text-[#C9962C] animate-spin" style={{ animationDuration: '6s' }} />
            <span>Autonomous Institutional Publishing &bull; 2026 Academic Edition</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-emerald-300 font-semibold">Continuous Draft Autosave Active</span>
          </div>

          {/* Main Title */}
          <h1 className="font-serif font-bold text-4xl sm:text-6xl lg:text-7xl text-white tracking-tight leading-[1.12] max-w-4xl">
            Empowering Campus Milestones from{' '}
            <span className="bg-gradient-to-r from-[#FBBF24] via-[#F59E0B] to-[#FDE68A] bg-clip-text text-transparent underline decoration-[#C9962C]/50 decoration-wavy decoration-2">
              Faculty Submissions
            </span>{' '}
            to Official Newsletters
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-slate-300 text-base sm:text-lg lg:text-xl max-w-2xl leading-relaxed font-light">
            A peer-reviewed academic publication ecosystem connecting <span className="text-white font-medium">Faculty</span> achievements,{' '}
            <span className="text-white font-medium">Coordinator</span> cluster curation, and{' '}
            <span className="text-white font-medium">Administration</span> master consolidation with automated draft preservation.
          </p>

          {/* CTA Row */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#C9962C] via-[#E0B563] to-[#D4A340] text-[#0F1424] font-bold text-base shadow-xl hover:shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              <span>{isAuthenticated ? 'Enter CNMS Dashboard' : 'Sign In to CNMS'}</span>
              <ArrowRight size={18} />
            </Link>

            <a
              href="#workflow"
              className="px-6 py-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-base border border-white/20 backdrop-blur-md hover:border-amber-300/40 transition-all flex items-center gap-2"
            >
              <span>How It Works</span>
              <ChevronDown size={16} />
            </a>

            <Link
              to="/newsletters"
              className="px-6 py-4 rounded-xl bg-slate-900/60 hover:bg-slate-900/80 text-amber-200 font-medium text-base border border-[#C9962C]/30 backdrop-blur-md transition-all flex items-center gap-2"
            >
              <BookOpen size={16} className="text-[#C9962C]" />
              <span>Browse Issues</span>
            </Link>
          </div>

          {/* Trust & Metric Strip */}
          <div className="mt-16 w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-left">
            {[
              {
                icon: Zap,
                num: '100%',
                title: 'Draft Autosave',
                sub: 'Never lose in-progress forms',
                color: 'text-amber-400 bg-amber-400/10'
              },
              {
                icon: Users,
                num: '3 Roles',
                title: 'Clean Governance',
                sub: 'Admin, Coordinator & Faculty',
                color: 'text-indigo-400 bg-indigo-400/10'
              },
              {
                icon: Layers,
                num: 'Standard',
                title: 'Cluster Reports',
                sub: 'Pre-fixed uniform format',
                color: 'text-emerald-400 bg-emerald-400/10'
              },
              {
                icon: RotateCcw,
                num: '2-Way',
                title: 'Feedback Loop',
                sub: 'Actionable coordinator notes',
                color: 'text-rose-400 bg-rose-400/10'
              }
            ].map((stat, i) => {
              const Icon = stat.icon
              return (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-[#0F1424]/80 backdrop-blur-md border border-white/10 hover:border-white/25 transition-all shadow-md group"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${stat.color}`}>
                      <Icon size={18} />
                    </span>
                    <div>
                      <p className="font-serif font-bold text-white text-lg leading-tight group-hover:text-amber-300 transition-colors">
                        {stat.num}
                      </p>
                      <p className="text-xs font-semibold text-slate-200">{stat.title}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 font-light">{stat.sub}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Marquee Ticker at the bottom of hero */}
        <div className="relative z-20 w-full overflow-hidden bg-[#0A0D18]/90 border-t border-b border-white/10 py-3">
          <div className="marquee-track flex whitespace-nowrap w-max text-xs uppercase tracking-[0.25em] text-slate-400 font-semibold">
            {[0, 1].map((copy) => (
              <span key={copy} className="flex items-center gap-8 px-4" aria-hidden={copy === 1}>
                <span className="text-amber-400 flex items-center gap-2">
                  <Flame size={14} /> Official Newsletter Platform
                </span>
                <span>&bull;</span>
                <span className="text-slate-300">BMSIT &amp; Management Doddaballapur Main Road Yelahanka</span>
                <span>&bull;</span>
                <span className="text-indigo-300">Research &bull; Patents &bull; NPTEL &bull; Events</span>
                <span>&bull;</span>
                <span className="text-emerald-300">Peer Reviewed &bull; Standardized Format &bull; Monthly Edition</span>
                <span>&bull;</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* THREE CORE ROLES SECTION */}
      <section id="roles" className="py-24 bg-gradient-to-b from-[#FDFBF7] via-[#F7F3EA] to-[#FDFBF7] border-b border-[#E6E1D6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C9962C]/15 text-[#8F6317] border border-[#C9962C]/30 text-xs font-bold uppercase tracking-wider mb-3">
              Role-Based Architecture
            </span>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#182138] tracking-tight">
              Designed for Every Academic Stakeholder
            </h2>
            <p className="mt-3 text-slate-600 text-base leading-relaxed">
              Clear segregation of duties with customized dashboards and focused permissions for Faculty, Coordinators, and Administrators.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {ROLE_CARDS.map((card) => {
              const Icon = card.icon
              return (
                <div
                  key={card.role}
                  className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden hover:-translate-y-1.5 group"
                >
                  {/* Card Header */}
                  <div className={`p-6 bg-gradient-to-br ${card.headerGradient} text-white border-b border-white/10`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`w-12 h-12 rounded-xl flex items-center justify-center border ${card.iconBg} shadow-inner`}>
                        <Icon size={24} />
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${card.badgeColor}`}>
                        {card.badge}
                      </span>
                    </div>
                    <h3 className="font-serif font-bold text-2xl text-white tracking-wide">{card.title}</h3>
                    <p className="text-xs uppercase tracking-wider text-slate-300 mt-0.5">Role: {card.role}</p>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-slate-600 text-sm leading-relaxed mb-6">{card.description}</p>

                      <div className="space-y-3 mb-6">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Key Capabilities</p>
                        {card.highlights.map((h, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700">
                            <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                            <span>{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Link
                      to={isAuthenticated ? '/dashboard' : '/login'}
                      className="mt-4 w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-sm font-semibold flex items-center justify-center gap-2 group-hover:border-[#C9962C] group-hover:text-[#182138] transition-all"
                    >
                      <span>{card.actionText}</span>
                      <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4-STEP PUBLISHING WORKFLOW SECTION */}
      <section id="workflow" className="py-24 bg-white border-b border-[#E6E1D6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold uppercase tracking-wider mb-3">
              Institutional Pipeline
            </span>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#182138] tracking-tight">
              The 4-Step Academic Publishing Workflow
            </h2>
            <p className="mt-3 text-slate-600 text-base leading-relaxed">
              From continuous draft submission to institutional collation, every step ensures accuracy, standard formats, and zero data loss.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {WORKFLOW_STEPS.map((s) => {
              const StepIcon = s.icon
              return (
                <div
                  key={s.step}
                  className="relative bg-[#FAF8F5] rounded-2xl p-6 border border-[#E6E1D6] hover:border-[#C9962C]/60 hover:shadow-lg transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-serif font-bold text-3xl text-[#C9962C]/60 group-hover:text-[#C9962C] transition-colors">
                        {s.step}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.roleColor}`}>
                        {s.role}
                      </span>
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-white border border-[#E6E1D6] shadow-sm flex items-center justify-center text-slate-700 mb-4 group-hover:scale-110 transition-transform">
                      <StepIcon size={20} className="text-[#182138]" />
                    </div>

                    <h3 className="font-serif font-bold text-lg text-[#182138] mb-2">{s.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">{s.desc}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#E6E1D6]/60 flex items-center gap-1.5 text-[11px] font-semibold text-[#8F6317]">
                    <Check size={13} />
                    <span>Step verified &amp; standardized</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ADVANCED PLATFORM CAPABILITIES GRID */}
      <section id="features" className="py-24 bg-gradient-to-b from-[#FDFBF7] to-[#F5EFE6] border-b border-[#E6E1D6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider mb-3">
              Standardized Excellence
            </span>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#182138] tracking-tight">
              Engineered for Precision &amp; Productivity
            </h2>
            <p className="mt-3 text-slate-600 text-base leading-relaxed">
              Every feature solves real academic publishing friction, from mid-entry draft auto-saving to multi-platform course verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {KEY_FEATURES.map((feat, index) => {
              const FeatIcon = feat.icon
              return (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-[#C9962C]/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-11 h-11 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] flex items-center justify-center text-[#182138]">
                        <FeatIcon size={22} className="text-[#C9962C]" />
                      </div>
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${feat.tagClass}`}>
                        {feat.tag}
                      </span>
                    </div>

                    <h3 className="font-serif font-bold text-lg text-[#182138] mb-2">{feat.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">{feat.desc}</p>
                  </div>

                  <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>Institutional Standard</span>
                    <Sparkles size={13} className="text-amber-500" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CALL TO ACTION BANNER */}
      <section className="py-20 bg-[#0F1424] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#C9962C_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <span className="w-14 h-14 rounded-2xl bg-[#C9962C]/20 border border-[#C9962C]/40 text-[#E0B563] inline-flex items-center justify-center mb-6 shadow-lg">
            <Building2 size={28} />
          </span>

          <h2 className="font-serif font-bold text-3xl sm:text-5xl text-white tracking-tight">
            Ready to Record Your Academic Milestones?
          </h2>

          <p className="mt-4 text-slate-300 text-base max-w-xl mx-auto leading-relaxed">
            Log in to record publications, curate cluster submissions, or consolidate the master monthly newsletter.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#C9962C] to-[#E0B563] text-[#0F1424] font-bold text-sm shadow-xl hover:brightness-110 hover:scale-105 transition-all flex items-center gap-2"
            >
              <span>{isAuthenticated ? 'Open Dashboard' : 'Sign In with Institutional ID'}</span>
              <ArrowRight size={16} />
            </Link>

            <Link
              to="/newsletters"
              className="px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm border border-white/20 transition-all flex items-center gap-2"
            >
              <BookOpen size={16} className="text-amber-300" />
              <span>Browse All Published Issues</span>
            </Link>
          </div>
        </div>
      </section>

      {/* INSTITUTIONAL ACADEMIC FOOTER */}
      <footer className="bg-[#090C16] text-slate-400 text-xs border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 pb-10 border-b border-white/10">
            {/* Col 1: Institute Info */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <img src={collegeLogo} alt="BMSIT Crest" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/20" />
                <div>
                  <h4 className="font-serif font-bold text-white text-sm">BMS Institute of Technology and Management</h4>
                  <p className="text-[11px] text-[#C9962C] uppercase tracking-wider">Autonomous Institution &bull; NAAC &apos;A&apos; Grade</p>
                </div>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-md">
                Doddaballapur Main Road, Avalahalli, Yelahanka, Bengaluru, Karnataka 560064. College Newsletter Management System (CNMS).
              </p>
            </div>

            {/* Col 2: Quick Links */}
            <div>
              <p className="font-semibold text-white uppercase tracking-wider text-[11px] mb-3">Portal Directory</p>
              <ul className="space-y-2">
                <li>
                  <Link to="/newsletters" className="hover:text-amber-300 transition-colors">
                    Monthly Newsletters
                  </Link>
                </li>
                <li>
                  <Link to="/publications" className="hover:text-amber-300 transition-colors">
                    Research Publications
                  </Link>
                </li>
                <li>
                  <Link to="/nptel-courses" className="hover:text-amber-300 transition-colors">
                    Certifications Registry
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard" className="hover:text-amber-300 transition-colors">
                    Activity Dashboard
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: System Status & Governance */}
            <div>
              <p className="font-semibold text-white uppercase tracking-wider text-[11px] mb-3">System Governance</p>
              <div className="space-y-2.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>All Portals Operational</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Auto-save draft engine active across all active login sessions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px]">
            <p>&copy; {new Date().getFullYear()} BMSIT &amp; Management. All rights reserved. CNMS Portal v2.0.</p>
            <div className="flex items-center gap-6">
              <span>Admin &bull; Coordinator &bull; Faculty Roles</span>
              <a href="#top" className="hover:text-amber-300 transition-colors">
                Back to top &uarr;
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
