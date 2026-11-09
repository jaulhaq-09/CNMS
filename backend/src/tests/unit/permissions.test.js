const {
    ROLES,
    SCOPE_LEVEL,
    PERMISSIONS,
    hasPermission,
    hasAnyPermission,
    canAccessScope,
    canCreateInScope,
} = require('../../config/permissions');

describe('hasPermission', () => {
    it('grants SUPER_ADMIN every permission via the wildcard', () => {
        expect(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.DEPARTMENTS_MANAGE)).toBe(true);
        expect(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.EVENTS_APPROVE)).toBe(true);
    });

    it('grants a role only the permissions explicitly listed for it', () => {
        expect(hasPermission(ROLES.FACULTY, PERMISSIONS.EVENTS_CREATE)).toBe(true);
        expect(hasPermission(ROLES.FACULTY, PERMISSIONS.EVENTS_APPROVE)).toBe(false);
    });

    it('returns false for an unknown role', () => {
        expect(hasPermission('NOT_A_REAL_ROLE', PERMISSIONS.DASHBOARD_VIEW)).toBe(false);
    });

    it('returns false when role or permission is missing', () => {
        expect(hasPermission(null, PERMISSIONS.DASHBOARD_VIEW)).toBe(false);
        expect(hasPermission(ROLES.FACULTY, null)).toBe(false);
    });

    it('COORDINATOR can approve events but cannot manage departments', () => {
        expect(hasPermission(ROLES.COORDINATOR, PERMISSIONS.EVENTS_APPROVE)).toBe(true);
        expect(hasPermission(ROLES.COORDINATOR, PERMISSIONS.DEPARTMENTS_MANAGE)).toBe(false);
    });

    it('GUEST only has dashboard and search access', () => {
        expect(hasPermission(ROLES.GUEST, PERMISSIONS.DASHBOARD_VIEW)).toBe(true);
        expect(hasPermission(ROLES.GUEST, PERMISSIONS.SEARCH_VIEW)).toBe(true);
        expect(hasPermission(ROLES.GUEST, PERMISSIONS.EVENTS_CREATE)).toBe(false);
    });
});

describe('hasAnyPermission', () => {
    it('returns true if the role has at least one of the listed permissions', () => {
        const result = hasAnyPermission(ROLES.FACULTY, [
            PERMISSIONS.EVENTS_APPROVE,
            PERMISSIONS.EVENTS_CREATE,
        ]);
        expect(result).toBe(true);
    });

    it('returns false if the role has none of the listed permissions', () => {
        const result = hasAnyPermission(ROLES.GUEST, [
            PERMISSIONS.EVENTS_APPROVE,
            PERMISSIONS.DEPARTMENTS_MANAGE,
        ]);
        expect(result).toBe(false);
    });
});

describe('canAccessScope', () => {
    const deptA = '507f1f77bcf86cd799439011';
    const deptB = '507f1f77bcf86cd799439012';

    it('SUPER_ADMIN (GLOBAL scope) can access any department/cluster/section', () => {
        const user = { role: ROLES.SUPER_ADMIN };
        expect(canAccessScope(user, { departmentId: deptA, clusterId: 'AI', sectionId: 'A' })).toBe(true);
    });

    it('COORDINATOR (CLUSTER scope) needs both matching department AND matching cluster', () => {
        const coordinator = { role: ROLES.COORDINATOR, department: deptA, clusters: ['AI'] };
        expect(canAccessScope(coordinator, { departmentId: deptA, clusterId: 'AI' })).toBe(true);
        expect(canAccessScope(coordinator, { departmentId: deptA, clusterId: 'Data Science' })).toBe(false);
        expect(canAccessScope(coordinator, { departmentId: deptB, clusterId: 'AI' })).toBe(false);
    });

    it('FACULTY (SECTION scope) needs matching department, cluster, AND section', () => {
        const faculty = {
            role: ROLES.FACULTY,
            department: deptA,
            clusters: ['AI'],
            sections: ['Section A'],
        };
        expect(
            canAccessScope(faculty, { departmentId: deptA, clusterId: 'AI', sectionId: 'Section A' })
        ).toBe(true);
        expect(
            canAccessScope(faculty, { departmentId: deptA, clusterId: 'AI', sectionId: 'Section B' })
        ).toBe(false);
    });

    it('GUEST (NONE scope) cannot access any scoped resource', () => {
        const guest = { role: ROLES.GUEST };
        expect(canAccessScope(guest, { departmentId: deptA })).toBe(false);
    });

    it('returns false when the user has no role', () => {
        expect(canAccessScope({}, { departmentId: deptA })).toBe(false);
    });
});

describe('canCreateInScope', () => {
    const deptA = '507f1f77bcf86cd799439011';
    const deptB = '507f1f77bcf86cd799439012';

    it('SUPER_ADMIN can create in any scope', () => {
        const user = { role: ROLES.SUPER_ADMIN };
        expect(canCreateInScope(user, { departmentId: deptB, clusterId: 'AI' })).toBe(true);
    });

    it('rejects creating in a different department than the user belongs to', () => {
        const faculty = { role: ROLES.FACULTY, department: deptA, clusters: ['AI'], sections: ['A'] };
        expect(canCreateInScope(faculty, { departmentId: deptB, clusterId: 'AI', sectionId: 'A' })).toBe(false);
    });

    it('FACULTY can only create in a cluster/section they are actually assigned to', () => {
        const faculty = {
            role: ROLES.FACULTY,
            department: deptA,
            clusters: ['AI', 'Data Science'],
            sections: ['Section A'],
        };
        expect(
            canCreateInScope(faculty, { departmentId: deptA, clusterId: 'AI', sectionId: 'Section A' })
        ).toBe(true);
        expect(
            canCreateInScope(faculty, { departmentId: deptA, clusterId: 'Robotics', sectionId: 'Section A' })
        ).toBe(false);
    });

});