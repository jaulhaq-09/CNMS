import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import collegeLogo from '../assets/college-logo.jpg'

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex bg-gradient-to-b from-[#FAF8F5] to-[#F3F0E9]">
      {/* Branded left panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#1B2340] via-[#241C42] to-[#3B2A3F]">
        {/* Decorative animated glow blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#C9962C]/25 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-[#E0956B]/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1.5s' }}
        />
        <div
          className="absolute top-1/3 right-10 w-64 h-64 bg-[#C9962C]/10 rounded-full blur-2xl animate-pulse"
          style={{ animationDelay: '0.7s' }}
        />
        {/* subtle grid texture for depth */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link to="/" className="flex items-center gap-3 w-fit group">
            <img
              src={collegeLogo}
              alt="BMS Institute of Technology and Management"
              className="h-11 w-11 rounded-full object-cover ring-2 ring-[#C9962C]/50 group-hover:ring-[#C9962C] transition-all"
            />
            <div className="leading-tight">
              <span className="font-serif font-semibold text-xl text-white tracking-wide block">
                CNMS
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#C9962C]/90">
                Est. 2026
              </span>
            </div>
          </Link>

          <div>
            <h1 className="font-serif font-semibold text-4xl text-white leading-tight mb-4">
              College Newsletter
              <br />
              <span className="bg-gradient-to-r from-[#E8C374] via-[#C9962C] to-[#E8C374] bg-clip-text text-transparent">
                Management System
              </span>
            </h1>
            <p className="text-white/60 text-sm max-w-sm leading-relaxed">
              One place to submit events, publications, and reports — reviewed, compiled, and
              delivered to your institute newsletter, every month.
            </p>
          </div>

          <p className="text-white/30 text-xs">
            &copy; {new Date().getFullYear()} CNMS. All rights reserved.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">

        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex flex-col items-center gap-1">
              <img
                src={collegeLogo}
                alt="BMS Institute of Technology and Management"
                className="h-12 w-12 rounded-full object-cover ring-2 ring-[#C9962C]/50 mb-1"
              />
              <span className="font-serif font-semibold text-2xl text-[#1B2340] tracking-wide">
                CNMS
              </span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#C9962C]">
                Est. 2026
              </span>
            </Link>
          </div>

          <div className="bg-white border border-[#E4E7EC] rounded-2xl shadow-xl shadow-[#1B2340]/5 p-8 sm:p-9">
            <Outlet />
          </div>

          <Link
            to="/"
            className="mt-6 inline-flex items-center justify-center gap-1.5 w-full text-sm text-[#667085] hover:text-[#1B2340] transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}