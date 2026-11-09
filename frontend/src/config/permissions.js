// Central RBAC config — scope-aware.
//
// Org hierarchy:  Department  >  Cluster  >  Section
//
// IMPORTANT: the real User model stores:
//   user.department  — ObjectId ref to Department (ONE per person)
//   user.clusters    — array of strings (a person can belong to several)
//   user.sections    — array of strings (same)
// resourceScope objects (e.g. an event) use departmentId/clusterId/
// sectionId as their key names purely for readability at call sites —
// an event only ever has ONE cluster/section (the one it was actually
// posted under), even though a person can be assigned to several.

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COORDINATOR: 'COORDINATOR',
  FACULTY: 'FACULTY',
  GUEST: 'GUEST',
}

export const SCOPE_LEVEL = {
  [ROLES.SUPER_ADMIN]: 'GLOBAL',
  [ROLES.COORDINATOR]: 'CLUSTER',
  [ROLES.FACULTY]: 'SECTION',
  [ROLES.GUEST]: 'NONE',
}

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard:view',
  SEARCH_VIEW: 'search:view',
  ANALYTICS_VIEW: 'analytics:view',

  TEMPLATES_VIEW: 'templates:view',
  TEMPLATES_CREATE: 'templates:create',
  TEMPLATES_EDIT: 'templates:edit',
  TEMPLATES_DELETE: 'templates:delete',

  EXPORT_VIEW: 'export:view',
  EXPORT_GENERATE: 'export:generate',

  REPORTS_VIEW: 'reports:view',
  REPORTS_GENERATE: 'reports:generate',
  REPORTS_SCHEDULE: 'reports:schedule',

  EVENTS_CREATE: 'events:create',
  EVENTS_VIEW_OWN: 'events:view_own',
  EVENTS_VIEW_SCOPE: 'events:view_scope',
  EVENTS_APPROVE: 'events:approve',

  NEWSLETTER_GENERATE: 'newsletter:generate',
  NEWSLETTER_PUBLISH: 'newsletter:publish',

  USERS_MANAGE: 'users:manage',
  SETTINGS_MANAGE: 'settings:manage',

  DEPARTMENTS_MANAGE: 'departments:manage',
}

const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ['*'],

  [ROLES.COORDINATOR]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SEARCH_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.EXPORT_VIEW,
    PERMISSIONS.EXPORT_GENERATE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_GENERATE,
    PERMISSIONS.REPORTS_SCHEDULE,
    PERMISSIONS.EVENTS_VIEW_SCOPE,
    PERMISSIONS.EVENTS_APPROVE,
    PERMISSIONS.NEWSLETTER_GENERATE,
    PERMISSIONS.NEWSLETTER_PUBLISH,
  ],

  [ROLES.FACULTY]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SEARCH_VIEW,
    PERMISSIONS.EVENTS_CREATE,
    PERMISSIONS.EVENTS_VIEW_OWN,
  ],

  [ROLES.GUEST]: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SEARCH_VIEW],
}

export function hasPermission(role, permission) {
  if (!role || !permission) return false
  const granted = ROLE_PERMISSIONS[role]
  if (!granted) return false
  return granted.includes('*') || granted.includes(permission)
}

export function hasAnyPermission(role, permissions = []) {
  return permissions.some((p) => hasPermission(role, p))
}

// ---- Scope checks -----------------------------------------------------

export function canAccessScope(user, resourceScope = {}) {
  if (!user?.role) return false
  const level = SCOPE_LEVEL[user.role]

  // Both sides are normalized to plain ID strings here, since either one
  // can arrive populated (an object with _id/name) depending on which
  // endpoint last set it — comparing a populated object against a string
  // with === always fails even when they refer to the same department.
  const userDepartmentId = user.department?._id || user.department
  const resourceDepartmentId = resourceScope.departmentId?._id || resourceScope.departmentId

  const userClusters = user.clusters || []
  const userSections = user.sections || []

  switch (level) {
    case 'GLOBAL':
      return true
    case 'DEPARTMENT':
      return !resourceDepartmentId || resourceDepartmentId === userDepartmentId
    case 'CLUSTER':
      return (
        (!resourceDepartmentId || resourceDepartmentId === userDepartmentId) &&
        (!resourceScope.clusterId || userClusters.includes(resourceScope.clusterId))
      )
    case 'SECTION':
      return (
        (!resourceDepartmentId || resourceDepartmentId === userDepartmentId) &&
        (!resourceScope.clusterId || userClusters.includes(resourceScope.clusterId)) &&
        (!resourceScope.sectionId || userSections.includes(resourceScope.sectionId))
      )
    default:
      return false
  }
}

// Can this user CREATE a resource targeting exactly this scope? Used to
// validate a FACULTY member's chosen cluster/section actually belongs to
// them, rather than blindly overwriting their choice — since they now
// pick from their own assigned list instead of having a single locked value.
export function canCreateInScope(user, targetScope = {}) {
  if (!user?.role) return false
  if (user.role === ROLES.SUPER_ADMIN) return true

  const userDepartmentId = user.department?._id || user.department
  const targetDepartmentId = targetScope.departmentId?._id || targetScope.departmentId

  const userClusters = user.clusters || []
  const userSections = user.sections || []
  const level = SCOPE_LEVEL[user.role]

  if (targetDepartmentId !== userDepartmentId) return false
  if (level !== 'DEPARTMENT' && !userClusters.includes(targetScope.clusterId)) return false
  if (level === 'SECTION' && !userSections.includes(targetScope.sectionId)) return false

  return true
}