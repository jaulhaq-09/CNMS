import { useSelector } from 'react-redux'
import {
  hasPermission,
  hasAnyPermission,
  canAccessScope,
  canCreateInScope,
} from '../config/permissions'

// Usage:
//   const { can, canAccessScope, scope } = usePermissions()
//   scope.departmentId — single value (one home department per person)
//   scope.clusters     — array (a person can belong to several)
//   scope.sections     — array (same)
//
// A specific RESOURCE (like one event) still only has one cluster/section
// — that's a separate concept from the arrays here, which represent
// everything this particular user is assigned to.
export default function usePermissions() {
  const user = useSelector((state) => state.auth?.user)
  const role = user?.role

  return {
    role,
    user,
    scope: {
      // user.department can come through populated (an object with _id/name)
      // depending on which endpoint last refreshed the auth state — unwrap
      // it once here so every consumer of scope.departmentId is safe,
      // instead of needing this same guard copy-pasted into every page.
      departmentId: user?.department?._id || user?.department,
      clusters: user?.clusters || [],
      sections: user?.sections || [],
    },
    can: (permission) => hasPermission(role, permission),
    canAny: (permissions) => hasAnyPermission(role, permissions),
    canAccessScope: (resourceScope) => canAccessScope(user, resourceScope),
    canCreateInScope: (targetScope) => canCreateInScope(user, targetScope),
  }
}