/**
 * Privilege-escalation guard for PUT /api/admin/users/:id and
 * POST /api/admin/users/invite (GHSA-rv8w-m6mx-7j4q).
 *
 * updateAdminUser's role-change path previously enforced only:
 *   (a) non-super_admin actors can't grant the super_admin role
 *   (b) no self-role-update / demoting the last super_admin
 * It never checked whether the ACTOR's own permission set covers the
 * permissions carried by the role being granted — so an admin holding
 * only `users.edit` could hand any other admin a role (including the
 * built-in `admin` role) carrying far more permissions than the actor
 * itself held.
 *
 * createInvitation() had the identical gap: it only ever blocked
 * granting super_admin, so an admin holding only `users.create` could
 * invite a brand-new admin into any other role — including one carrying
 * far more permissions than the inviter itself held — via
 * POST /admin/users/invite.
 *
 * The fix adds assertActorMayGrant() — a local containment guard, since
 * stable does not yet have main's custom-role-creation service or its
 * roles.manage equivalent — inside both updateAdminUser's role_id branch
 * and createInvitation().
 *
 * Both describe blocks below share a single bootCrmDb() call: the
 * `db` module (`src/database/db.js`) is a singleton keyed off
 * TEST_DATABASE_PATH at first require, and bootCrmDb's own comment
 * warns that a second call after the first's cleanup() destroys the
 * pool, leaving "Unable to acquire a connection" for every later query.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-rolegrantguard-')), 'db.sqlite',
);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'rolegrantguard-test-secret';
process.env.STORAGE_PATH = fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-rolegrantguard-storage-'));

const { bootCrmDb, seedMinimal, assignAdminRole } = require('../integration/helpers/crmDb');
const svc = require('../../src/services/userManagementService');
const { clearPermissionCache } = require('../../src/middleware/permissions');

// Stable has no custom-role-creation service (that's main-only); build a role
// directly against the roles/permissions/role_permissions schema instead.
async function createRole(db, name, permissionNames) {
  const [roleRow] = await db('roles').insert({
    name, display_name: name, is_system: false, priority: 10, created_at: new Date(), updated_at: new Date(),
  }).returning('id');
  const roleId = roleRow?.id ?? roleRow;
  if (permissionNames.length > 0) {
    const perms = await db('permissions').whereIn('name', permissionNames).select('id', 'name');
    if (perms.length !== permissionNames.length) {
      throw new Error(`Missing seeded permission(s) for: ${permissionNames.join(', ')}`);
    }
    await db('role_permissions').insert(perms.map((p) => ({ role_id: roleId, permission_id: p.id })));
  }
  return { id: roleId };
}

let db; let cleanup;
let superId;

beforeAll(async () => {
  ({ db, cleanup } = await bootCrmDb());
  ({ adminId: superId } = await seedMinimal(db));
  await assignAdminRole(db, superId, 'super_admin');
  clearPermissionCache();
}, 120000);

afterAll(async () => { if (cleanup) await cleanup(); });

describe('updateAdminUser — role-grant privilege-escalation guard (GHSA-rv8w-m6mx-7j4q)', () => {
  let limitedRoleId; let limitedId; // holds only users.edit + events.view
  let powerfulRoleId; // carries settings.edit, which limitedId does NOT hold
  let modestRoleId; // carries only events.view, a subset of what limitedId holds
  let targetId; // account whose role limitedId will try to change

  beforeAll(async () => {
    // The attacker in GHSA-rv8w-m6mx-7j4q: users.edit only, nothing else.
    const limitedRole = await createRole(db, 'limited_user_editor', ['users.edit', 'events.view']);
    limitedRoleId = limitedRole.id;
    const limitedIns = await db('admin_users').insert({
      username: 'limited', email: 'limited@example.com', password_hash: 'x',
      role_id: limitedRoleId, must_change_password: false, created_at: new Date(),
    }).returning('id');
    limitedId = limitedIns[0]?.id ?? limitedIns[0];

    // A role carrying a permission the limited actor does not hold.
    const powerfulRole = await createRole(db, 'powerful_role', ['users.edit', 'settings.edit']);
    powerfulRoleId = powerfulRole.id;

    // A role whose permissions ARE a subset of what the limited actor holds.
    const modestRole = await createRole(db, 'modest_role', ['events.view']);
    modestRoleId = modestRole.id;

    clearPermissionCache();
  }, 120000);

  beforeEach(async () => {
    // Fresh target for every test, role reset to modestRole so role-change
    // assertions always start from a known baseline.
    const existing = await db('admin_users').where({ username: 'target' }).first();
    if (existing) {
      targetId = existing.id;
      await db('admin_users').where({ id: targetId }).update({ role_id: modestRoleId });
    } else {
      const ins = await db('admin_users').insert({
        username: 'target', email: 'target@example.com', password_hash: 'x',
        role_id: modestRoleId, must_change_password: false, created_at: new Date(),
      }).returning('id');
      targetId = ins[0]?.id ?? ins[0];
    }
  });

  it('refuses to let an admin grant a role carrying permissions the admin lacks', async () => {
    await expect(
      svc.updateAdminUser(
        targetId,
        { role_id: powerfulRoleId },
        limitedId,
        { roleName: 'limited_user_editor' },
      ),
    ).rejects.toThrow(/only grant permissions your own role/i);

    // Target's role must be unchanged.
    const row = await db('admin_users').where({ id: targetId }).first();
    expect(row.role_id).toBe(modestRoleId);
  });

  it('refuses to let an admin grant the built-in admin role beyond its own permissions', async () => {
    const adminRole = await db('roles').where({ name: 'admin' }).first();
    await expect(
      svc.updateAdminUser(
        targetId,
        { role_id: adminRole.id },
        limitedId,
        { roleName: 'limited_user_editor' },
      ),
    ).rejects.toThrow(/only grant permissions your own role/i);
  });

  it('allows an admin to grant a role whose permissions it already holds', async () => {
    const updated = await svc.updateAdminUser(
      targetId,
      { role_id: limitedRoleId },
      limitedId,
      { roleName: 'limited_user_editor' },
    );
    expect(updated.role_id).toBe(limitedRoleId);
  });

  it('super_admin can still grant any role, including one carrying more permissions than a limited actor holds', async () => {
    const updated = await svc.updateAdminUser(
      targetId,
      { role_id: powerfulRoleId },
      superId,
      { roleName: 'super_admin' },
    );
    expect(updated.role_id).toBe(powerfulRoleId);
  });
});

describe('createInvitation — role-grant privilege-escalation guard (GHSA-rv8w-m6mx-7j4q)', () => {
  let limitedRoleId; let limitedId; // holds only users.create + events.view
  let powerfulRoleId; // carries settings.edit, which limitedId does NOT hold
  let modestRoleId; // carries only events.view, a subset of what limitedId holds
  let inviteCounter = 0;

  beforeAll(async () => {
    const limitedRole = await createRole(db, 'limited_inviter', ['users.create', 'events.view']);
    limitedRoleId = limitedRole.id;
    const limitedIns = await db('admin_users').insert({
      username: 'limited_inviter', email: 'limited_inviter@example.com', password_hash: 'x',
      role_id: limitedRoleId, must_change_password: false, created_at: new Date(),
    }).returning('id');
    limitedId = limitedIns[0]?.id ?? limitedIns[0];

    const powerfulRole = await createRole(db, 'powerful_invite_role', ['users.create', 'settings.edit']);
    powerfulRoleId = powerfulRole.id;

    const modestRole = await createRole(db, 'modest_invite_role', ['events.view']);
    modestRoleId = modestRole.id;

    clearPermissionCache();
  }, 120000);

  function nextEmail() {
    inviteCounter += 1;
    return `invitee-${inviteCounter}@example.com`;
  }

  it('refuses to let an admin invite someone into a role carrying permissions the admin lacks', async () => {
    await expect(
      svc.createInvitation({
        email: nextEmail(),
        roleId: powerfulRoleId,
        invitedById: limitedId,
        inviterRoleName: 'limited_inviter',
      }),
    ).rejects.toThrow(/only grant permissions your own role/i);
  });

  it('allows an admin to invite someone into a role whose permissions it already holds', async () => {
    const invitation = await svc.createInvitation({
      email: nextEmail(),
      roleId: limitedRoleId,
      invitedById: limitedId,
      inviterRoleName: 'limited_inviter',
    });
    expect(invitation.role).toBeTruthy();
  });

  it('allows an admin to invite someone into a role that is a subset of its own permissions', async () => {
    const invitation = await svc.createInvitation({
      email: nextEmail(),
      roleId: modestRoleId,
      invitedById: limitedId,
      inviterRoleName: 'limited_inviter',
    });
    expect(invitation.role).toBeTruthy();
  });

  it('super_admin can still invite into any role, including one carrying more permissions than a limited actor holds', async () => {
    const invitation = await svc.createInvitation({
      email: nextEmail(),
      roleId: powerfulRoleId,
      invitedById: superId,
      inviterRoleName: 'super_admin',
    });
    expect(invitation.role).toBeTruthy();
  });
});
