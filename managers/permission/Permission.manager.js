'use strict';

const { layers } = require('../../static_arch/main.system');

/**
 * Permission.manager.js
 *
 * Lightweight RBAC checker that reads directly from the layers config.
 * Replaces SharkFin for school management authorization.
 *
 * Usage in managers:
 *   await this.permissions.check(__user, 'students', 'transfer');
 *   // throws 403 if not allowed, returns true if allowed
 *
 * Or to test without throwing:
 *   const ok = this.permissions.can(__user, 'students', 'transfer');
 */

module.exports = class PermissionManager {

    constructor({ config, managers }) {
        this.config   = config;
        this.managers = managers;
        this.name     = 'permissions';

        // Build a flat lookup: role → resource → Set of allowed actions
        this._table = this._buildTable();
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    _buildTable() {
        const table = {};
        for (const [role, config] of Object.entries(layers)) {
            if (!config.permissions) continue;  // skip 'board' and others
            table[role] = {};
            for (const [resource, actions] of Object.entries(config.permissions)) {
                table[role][resource] = new Set(
                    Object.entries(actions)
                        .filter(([, allowed]) => allowed === true)
                        .map(([action]) => action)
                );
            }
        }
        return table;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Returns true if the user's role permits the action on the resource.
     * No side effects — use this for conditional logic.
     */
    can(user, resource, action) {
        if (!user || !user.role) return false;
        const rolePerms = this._table[user.role];
        if (!rolePerms) return false;
        const resourcePerms = rolePerms[resource];
        if (!resourcePerms) return false;
        return resourcePerms.has(action);
    }

    /**
     * Like can(), but throws a structured error if permission is denied.
     * Use this at the top of manager methods as a guard.
     *
     * @throws {{ message: string, code: 403 }}
     */
    check(user, resource, action) {
        if (this.can(user, resource, action)) return true;

        const role = user?.role ?? 'unauthenticated';
        throw {
            message: `Permission denied: role '${role}' cannot perform '${action}' on '${resource}'`,
            code:  403,
        };
    }

    /**
     * Asserts the requesting user is operating within their own school.
     * school_admin must only touch resources belonging to their schoolId.
     * superadmin is always allowed through.
     *
     * @throws {{ message: string, code: 403 }}
     */
    checkSchoolScope(user, resourceSchoolId) {
        if (user.role === 'superadmin') return true;

        const userSchoolId      = user.schoolId?.toString();
        const resourceSchool    = resourceSchoolId?.toString();

        if (!userSchoolId || !resourceSchool || userSchoolId !== resourceSchool) {
            throw {
                message: 'Access denied: resource belongs to a different school',
                code:    403,
            };
        }
        return true;
    }

    /**
     * Convenience: check both action permission AND school scope in one call.
     */
    checkWithScope(user, resource, action, resourceSchoolId) {
        this.check(user, resource, action);
        if (user.role !== 'superadmin') {
            this.checkSchoolScope(user, resourceSchoolId);
        }
        return true;
    }
};