import React from 'react'

const API_ORIGIN = 'http://localhost:5000'

export function photoUrl(path) {
  if (!path) return null
  return /^(https?:|blob:|data:)/.test(path) ? path : `${API_ORIGIN}${path}`
}

export function initialsOf(user) {
  const a = user?.firstName?.[0] || ''
  const b = user?.lastName?.[0] || ''
  return (a + b).toUpperCase() || 'U'
}

export default function Avatar({ user, src, size = 32, ringClassName = '' }) {
  const url = src || photoUrl(user?.profilePhoto)
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }

  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={style}
        className={`rounded-full object-cover shrink-0 ${ringClassName}`}
      />
    )
  }

  return (
    <span
      style={style}
      className={`rounded-full bg-gradient-to-br from-[#1B2340] to-[#3B2A3F] text-white font-semibold flex items-center justify-center shrink-0 ${ringClassName}`}
    >
      {initialsOf(user)}
    </span>
  )
}