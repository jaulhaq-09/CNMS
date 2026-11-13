import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import AuthLayout from './layouts/AuthLayout'
import DashboardLayout from './layouts/DashboardLayout'

import LoginPage from './components/auth/LoginPage'
import RegistrationInfoPage from './components/auth/RegistrationInfoPage'
import ForgotPasswordPage from './components/auth/ForgotPasswordPage'
import ForgotUsernamePage from './components/auth/ForgotUsernamePage'
import ResetPasswordPage from './components/auth/ResetPasswordPage'
import VerifyEmailPage from './components/auth/VerifyEmailPage'
import TwoFactorVerify from './components/auth/TwoFactorVerify'
import ProtectedRoute from './components/auth/ProtectedRoute'
import OAuthCallbackPage from './components/auth/OAuthCallbackPage'

import DashboardEntry from './pages/DashboardEntry'
import TemplatePage from './pages/TemplatePage'
import ReportPage from './pages/ReportPage'
import PostEventPage from './pages/PostEventPage'
import ForbiddenPage from './pages/ForbiddenPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import EventDetailPage from './pages/EventDetailPage'
import NewslettersPage from './pages/NewslettersPage'
import PostPublicationPage from './pages/PostPublicationPage'
import PublicationDetailPage from './pages/PublicationDetailPage'
import PublicationListPage from './pages/PublicationListPage'
import NptelCoursesPage from './pages/NptelCourseLogPage'
import HomePage from './pages/HomePage'
import PostFacultyAchievementPage from './pages/PostFacultyAchievementPage'
import PostPatentPage from './pages/PostPatentPage'
import MonthlyReportPage from './pages/MonthlyReportPage'

import { PERMISSIONS } from './config/permissions'
import EventApprovalPage from './pages/EventApprovalPage'
import DepartmentManagementPage from './components/admin/DepartmentManagementPage'
import UserManagementPage from './components/admin/UserManagementPage'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public / Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegistrationInfoPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/forgot-username" element={<ForgotUsernamePage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/verify-email-pending" element={<VerifyEmailPage />} />
          <Route path="/verify-2fa" element={<TwoFactorVerify />} />
          <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
        </Route>

        {/* Forbidden page — reachable whether or not you're authenticated,
            since ProtectedRoute itself redirects here on a permission miss */}
        <Route path="/forbidden" element={<ForbiddenPage />} />

        {/* Protected routes — auth required for all of these */}
        <Route element={<ProtectedRoute />}>
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardEntry />} />
            <Route path="/search" element={<Navigate to="/dashboard" replace />} />
            <Route path="/profile" element={<Navigate to="/dashboard" replace />} />

            {/* These need a real role. A Guest only gets the dashboard. */}
            <Route element={<ProtectedRoute permission={PERMISSIONS.TEMPLATES_VIEW} />}>
              <Route path="/templates" element={<TemplatePage />} />
            </Route>
            <Route element={<ProtectedRoute permission={PERMISSIONS.EVENTS_CREATE} />}>
              <Route path="/events/:id" element={<EventDetailPage />} />
              <Route path="/nptel-courses" element={<NptelCoursesPage />} />
            </Route>

            {/* Permission-guarded on top of the auth check above */}
            <Route element={<ProtectedRoute permission={PERMISSIONS.ANALYTICS_VIEW} />}>
              <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
            </Route>
            <Route element={<ProtectedRoute permission={PERMISSIONS.EXPORT_VIEW} />}>
              <Route path="/export" element={<Navigate to="/reports" replace />} />
            </Route>
            <Route element={<ProtectedRoute permission={PERMISSIONS.REPORTS_VIEW} />}>
              <Route path="/reports" element={<ReportPage />} />
            </Route>
            <Route element={<ProtectedRoute permission={PERMISSIONS.EVENTS_CREATE} />}>
              <Route path="/post" element={<MonthlyReportPage />} />
              <Route path="/post-event" element={<PostEventPage />} />
            </Route>
            <Route path="/newsletter" element={<Navigate to="/newsletters" replace />} />
            <Route element={<ProtectedRoute permission={PERMISSIONS.EVENTS_APPROVE} />}>
              <Route path="/approvals" element={<EventApprovalPage />} />
            </Route>
            <Route element={<ProtectedRoute permission={PERMISSIONS.DEPARTMENTS_MANAGE} />}>
              <Route path="/admin/departments" element={<DepartmentManagementPage />} />
            </Route>
            <Route element={<ProtectedRoute permission={PERMISSIONS.USERS_MANAGE} />}>
              <Route path="/admin/users" element={<UserManagementPage />} />
            </Route>
            <Route element={<ProtectedRoute permission={PERMISSIONS.NEWSLETTER_GENERATE} />}>
              <Route path="/newsletters" element={<NewslettersPage />} />
            </Route>
            <Route path="/admin/audit-log" element={<Navigate to="/dashboard" replace />} />
            <Route path="/admin/settings" element={<Navigate to="/dashboard" replace />} />
            <Route element={<ProtectedRoute permission={PERMISSIONS.EVENTS_CREATE} />}>
              <Route path="/post-achievement" element={<PostFacultyAchievementPage />} />
              <Route path="/post-patent" element={<PostPatentPage />} />
            </Route>
            <Route element={<ProtectedRoute permission={PERMISSIONS.EVENTS_CREATE} />}>
              <Route path="/post-publication" element={<PostPublicationPage />} />
            </Route>
            <Route element={<ProtectedRoute permission={PERMISSIONS.EVENTS_CREATE} />}>
              <Route path="/publications" element={<PublicationListPage />} />
              <Route path="/publications/:id" element={<PublicationDetailPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}