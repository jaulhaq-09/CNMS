import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { hasPermission, hasAnyPermission } from '../../config/permissions'

// Same auth check you already had, plus two optional props:
//   permission — a single PERMISSIONS.* value the role must have
//   anyOf      — an array; role must have at least one
//
//   <Route element={<ProtectedRoute />}>                                   auth only, unchanged behavior
//   <Route element={<ProtectedRoute permission={PERMISSIONS.ANALYTICS_VIEW} />}>
export default function ProtectedRoute({ permission, anyOf }) {
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const role = user?.role

  // First login with an Admin-issued temporary password: must set their own first.
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  // GUEST = signed in but no role assigned by the Admin yet.
  // They may only see the Dashboard (which shows a "waiting for access" card).
  if (role === 'GUEST' && location.pathname !== '/dashboard') {
    return <Navigate to="/dashboard" replace />
  }
  let allowed = true
  if (permission) {
    allowed = hasPermission(role, permission)
  } else if (anyOf) {
    allowed = hasAnyPermission(role, anyOf)
  }

  if (!allowed) {
    return <Navigate to="/forbidden" replace />
  }

  return <Outlet />
}