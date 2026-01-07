/**
 * User Management Service for Admin Users
 * Handles invitations, user CRUD, and role management
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { db, logActivity } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { generateReadablePassword } = require('../utils/passwordGenerator');
const { getBcryptRounds } = require('../utils/passwordValidation');
const { queueEmail } = require('./emailProcessor');
const logger = require('../utils/logger');
const { ConflictError, NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Create a new admin user invitation
 * @param {object} params - { email, roleId, invitedById }
 * @returns {Promise<object>} Created invitation details
 */
async function createInvitation({ email, roleId, invitedById }) {
  // Check if email already exists
  const existingUser = await db('admin_users').where('email', email).first();
  if (existingUser) {
    throw new ConflictError('User with this email already exists', 'email');
  }

  // Check for pending invitation
  const pendingInvite = await db('admin_invitations')
    .where('email', email)
    .whereNull('accepted_at')
    .where('expires_at', '>', new Date())
    .first();

  if (pendingInvite) {
    throw new ConflictError('Pending invitation already exists for this email', 'email');
  }

  // Validate role exists
  const role = await db('roles').where('id', roleId).first();
  if (!role) {
    throw new NotFoundError('Role', roleId);
  }

  // Generate secure invitation token (64 characters hex = 32 bytes)
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [invitationId] = await db('admin_invitations').insert({
    email,
    token,
    role_id: roleId,
    invited_by: invitedById,
    expires_at: expiresAt,
    created_at: new Date()
  }).returning('id');

  const id = invitationId?.id || invitationId;

  // Queue invitation email
  const frontendUrl = process.env.FRONTEND_URL || process.env.ADMIN_URL || 'http://localhost:3005';
  await queueEmail(null, email, 'admin_invitation', {
    invite_link: `${frontendUrl}/admin/accept-invite/${token}`,
    role_name: role.display_name,
    expires_at: expiresAt.toISOString()
  });

  await logActivity('admin_invitation_created',
    { email, roleId, roleName: role.display_name },
    null,
    { type: 'admin', id: invitedById, name: 'system' }
  );

  logger.info('Admin invitation created', { email, roleId, invitedById });

  return { id, email, token, role: role.display_name, expiresAt };
}

/**
 * Accept an invitation and create the admin user
 * @param {object} params - { token, username, password }
 * @returns {Promise<object>} Created user details
 */
async function acceptInvitation({ token, username, password }) {
  const invitation = await db('admin_invitations')
    .where('token', token)
    .whereNull('accepted_at')
    .where('expires_at', '>', new Date())
    .first();

  if (!invitation) {
    throw new ValidationError('Invalid or expired invitation');
  }

  // Check username availability
  const existingUsername = await db('admin_users').where('username', username).first();
  if (existingUsername) {
    throw new ConflictError('Username already taken', 'username');
  }

  // Check email not taken (race condition protection)
  const existingEmail = await db('admin_users').where('email', invitation.email).first();
  if (existingEmail) {
    throw new ConflictError('Email already registered', 'email');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, getBcryptRounds());

  // Create user in transaction
  const result = await db.transaction(async (trx) => {
    const [userId] = await trx('admin_users').insert({
      username,
      email: invitation.email,
      password_hash: passwordHash,
      role_id: invitation.role_id,
      created_by: invitation.invited_by,
      is_active: formatBoolean(true),
      must_change_password: formatBoolean(false),
      invite_accepted_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    }).returning('id');

    const id = userId?.id || userId;

    // Mark invitation as accepted
    await trx('admin_invitations')
      .where('id', invitation.id)
      .update({
        accepted_at: new Date(),
        accepted_user_id: id
      });

    return id;
  });

  await logActivity('admin_invitation_accepted',
    { userId: result, email: invitation.email },
    null,
    { type: 'system', id: null, name: 'system' }
  );

  logger.info('Admin invitation accepted', {
    userId: result,
    email: invitation.email,
    invitationId: invitation.id
  });

  return { userId: result, email: invitation.email };
}

/**
 * Get all admin users with their roles
 * @returns {Promise<object[]>}
 */
async function getAllAdminUsers() {
  return db('admin_users')
    .leftJoin('roles', 'roles.id', 'admin_users.role_id')
    .leftJoin('admin_users as creator', 'creator.id', 'admin_users.created_by')
    .select(
      'admin_users.id',
      'admin_users.username',
      'admin_users.email',
      'admin_users.is_active',
      'admin_users.last_login',
      'admin_users.last_login_ip',
      'admin_users.created_at',
      'admin_users.updated_at',
      'roles.id as role_id',
      'roles.name as role_name',
      'roles.display_name as role_display_name',
      'creator.username as created_by_username'
    )
    .orderBy('admin_users.created_at', 'desc');
}

/**
 * Get single admin user by ID
 * @param {number} id - User ID
 * @returns {Promise<object>}
 */
async function getAdminUserById(id) {
  const user = await db('admin_users')
    .leftJoin('roles', 'roles.id', 'admin_users.role_id')
    .where('admin_users.id', id)
    .select(
      'admin_users.id',
      'admin_users.username',
      'admin_users.email',
      'admin_users.is_active',
      'admin_users.last_login',
      'admin_users.last_login_ip',
      'admin_users.created_at',
      'admin_users.updated_at',
      'roles.id as role_id',
      'roles.name as role_name',
      'roles.display_name as role_display_name'
    )
    .first();

  if (!user) {
    throw new NotFoundError('Admin user', id);
  }

  return user;
}

/**
 * Update admin user
 * @param {number} id - User ID to update
 * @param {object} updates - Fields to update
 * @param {number} updatedById - ID of user making the update
 * @returns {Promise<object>} Updated user
 */
async function updateAdminUser(id, updates, updatedById) {
  const user = await db('admin_users').where('id', id).first();
  if (!user) {
    throw new NotFoundError('Admin user', id);
  }

  const allowedUpdates = {};

  if (updates.username !== undefined) {
    const existing = await db('admin_users')
      .where('username', updates.username)
      .whereNot('id', id)
      .first();
    if (existing) {
      throw new ConflictError('Username already taken', 'username');
    }
    allowedUpdates.username = updates.username;
  }

  if (updates.email !== undefined) {
    const existing = await db('admin_users')
      .where('email', updates.email)
      .whereNot('id', id)
      .first();
    if (existing) {
      throw new ConflictError('Email already in use', 'email');
    }
    allowedUpdates.email = updates.email;
  }

  if (updates.role_id !== undefined) {
    const role = await db('roles').where('id', updates.role_id).first();
    if (!role) {
      throw new NotFoundError('Role', updates.role_id);
    }
    allowedUpdates.role_id = updates.role_id;
  }

  if (updates.is_active !== undefined) {
    allowedUpdates.is_active = formatBoolean(updates.is_active);
  }

  allowedUpdates.updated_at = new Date();

  await db('admin_users').where('id', id).update(allowedUpdates);

  await logActivity('admin_user_updated',
    { userId: id, changes: Object.keys(allowedUpdates) },
    null,
    { type: 'admin', id: updatedById, name: 'system' }
  );

  return getAdminUserById(id);
}

/**
 * Deactivate admin user
 * @param {number} id - User ID to deactivate
 * @param {number} deactivatedById - ID of user performing deactivation
 */
async function deactivateAdminUser(id, deactivatedById) {
  const user = await db('admin_users').where('id', id).first();
  if (!user) {
    throw new NotFoundError('Admin user', id);
  }

  // Prevent self-deactivation
  if (id === deactivatedById) {
    throw new ValidationError('Cannot deactivate your own account');
  }

  // Check if this is the last super_admin
  const superAdminRole = await db('roles').where('name', 'super_admin').first();
  if (user.role_id === superAdminRole?.id) {
    const superAdminCount = await db('admin_users')
      .where('role_id', superAdminRole.id)
      .where('is_active', formatBoolean(true))
      .count('id as count')
      .first();

    if (Number(superAdminCount?.count) <= 1) {
      throw new ValidationError('Cannot deactivate the last Super Admin');
    }
  }

  await db('admin_users').where('id', id).update({
    is_active: formatBoolean(false),
    updated_at: new Date()
  });

  await logActivity('admin_user_deactivated',
    { userId: id, username: user.username },
    null,
    { type: 'admin', id: deactivatedById, name: 'system' }
  );

  logger.info('Admin user deactivated', { userId: id, deactivatedById });
}

/**
 * Reset admin user password (generates new password)
 * @param {number} id - User ID
 * @param {number} resetById - ID of user performing reset
 * @returns {Promise<object>} Result with email and status
 */
async function resetAdminPassword(id, resetById) {
  const user = await db('admin_users').where('id', id).first();
  if (!user) {
    throw new NotFoundError('Admin user', id);
  }

  const newPassword = generateReadablePassword();
  const passwordHash = await bcrypt.hash(newPassword, getBcryptRounds());

  await db('admin_users').where('id', id).update({
    password_hash: passwordHash,
    must_change_password: formatBoolean(true),
    password_changed_at: new Date(),
    updated_at: new Date()
  });

  // Queue password reset email
  await queueEmail(null, user.email, 'admin_password_reset', {
    username: user.username,
    new_password: newPassword
  });

  await logActivity('admin_password_reset',
    { userId: id, username: user.username },
    null,
    { type: 'admin', id: resetById, name: 'system' }
  );

  logger.info('Admin password reset', { userId: id, resetById });

  return { email: user.email, passwordSent: true };
}

/**
 * Get all roles
 * @returns {Promise<object[]>}
 */
async function getAllRoles() {
  return db('roles')
    .select('id', 'name', 'display_name', 'description', 'is_system', 'priority')
    .orderBy('priority', 'desc');
}

/**
 * Get pending invitations
 * @returns {Promise<object[]>}
 */
async function getPendingInvitations() {
  return db('admin_invitations')
    .join('roles', 'roles.id', 'admin_invitations.role_id')
    .join('admin_users', 'admin_users.id', 'admin_invitations.invited_by')
    .whereNull('admin_invitations.accepted_at')
    .where('admin_invitations.expires_at', '>', new Date())
    .select(
      'admin_invitations.id',
      'admin_invitations.email',
      'admin_invitations.expires_at',
      'admin_invitations.created_at',
      'roles.display_name as role_name',
      'admin_users.username as invited_by'
    )
    .orderBy('admin_invitations.created_at', 'desc');
}

/**
 * Cancel/delete an invitation
 * @param {number} id - Invitation ID
 * @param {number} cancelledById - ID of user cancelling
 */
async function cancelInvitation(id, cancelledById) {
  const invitation = await db('admin_invitations').where('id', id).first();
  if (!invitation) {
    throw new NotFoundError('Invitation', id);
  }

  await db('admin_invitations').where('id', id).del();

  await logActivity('admin_invitation_cancelled',
    { invitationId: id, email: invitation.email },
    null,
    { type: 'admin', id: cancelledById, name: 'system' }
  );

  logger.info('Admin invitation cancelled', { invitationId: id, cancelledById });
}

/**
 * Validate an invitation token
 * @param {string} token - Invitation token
 * @returns {Promise<object|null>} Invitation details if valid
 */
async function validateInvitationToken(token) {
  const invitation = await db('admin_invitations')
    .join('roles', 'roles.id', 'admin_invitations.role_id')
    .where('admin_invitations.token', token)
    .whereNull('admin_invitations.accepted_at')
    .where('admin_invitations.expires_at', '>', new Date())
    .select(
      'admin_invitations.email',
      'admin_invitations.expires_at',
      'roles.display_name as role_name'
    )
    .first();

  return invitation || null;
}

module.exports = {
  createInvitation,
  acceptInvitation,
  getAllAdminUsers,
  getAdminUserById,
  updateAdminUser,
  deactivateAdminUser,
  resetAdminPassword,
  getAllRoles,
  getPendingInvitations,
  cancelInvitation,
  validateInvitationToken
};
