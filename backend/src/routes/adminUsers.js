/**
 * Admin Users Routes
 * Handles user management, roles, and invitations
 */

const express = require('express');
const { body, param } = require('express-validator');
const { adminAuth } = require('../middleware/auth');
const { requirePermission, requireSuperAdmin, getUserPermissions } = require('../middleware/permissions');
const { handleAsync, validateRequest, successResponse } = require('../utils/routeHelpers');
const userManagementService = require('../services/userManagementService');
const router = express.Router();

/**
 * Transform user object from snake_case (DB) to camelCase (API)
 */
function transformUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isActive: user.is_active,
    lastLogin: user.last_login,
    lastLoginIp: user.last_login_ip,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    roleId: user.role_id,
    roleName: user.role_name,
    roleDisplayName: user.role_display_name,
    createdByUsername: user.created_by_username
  };
}

/**
 * Transform role object from snake_case (DB) to camelCase (API)
 */
function transformRole(role) {
  return {
    id: role.id,
    name: role.name,
    displayName: role.display_name,
    description: role.description,
    isSystem: role.is_system,
    priority: role.priority
  };
}

/**
 * Transform invitation object from snake_case (DB) to camelCase (API)
 */
function transformInvitation(invitation) {
  return {
    id: invitation.id,
    email: invitation.email,
    expiresAt: invitation.expires_at,
    createdAt: invitation.created_at,
    roleName: invitation.role_name,
    invitedBy: invitation.invited_by
  };
}

/**
 * GET /me/permissions
 * Get current user's permissions
 */
router.get('/me/permissions', adminAuth, handleAsync(async (req, res) => {
  const permissions = await getUserPermissions(req.admin.id);
  res.json(permissions);
}));

/**
 * GET /
 * List all admin users
 * Requires: users.view permission
 */
router.get('/', adminAuth, requirePermission('users.view'), handleAsync(async (req, res) => {
  const users = await userManagementService.getAllAdminUsers();
  res.json({ users: users.map(transformUser) });
}));

/**
 * GET /roles
 * List all roles
 * Requires: users.view permission
 */
router.get('/roles', adminAuth, requirePermission('users.view'), handleAsync(async (req, res) => {
  const roles = await userManagementService.getAllRoles();
  res.json({ roles: roles.map(transformRole) });
}));

/**
 * GET /invitations
 * List pending invitations
 * Requires: users.view permission
 */
router.get('/invitations', adminAuth, requirePermission('users.view'), handleAsync(async (req, res) => {
  const invitations = await userManagementService.getPendingInvitations();
  res.json({ invitations: invitations.map(transformInvitation) });
}));

/**
 * POST /invite
 * Create invitation
 * Requires: users.create permission
 */
router.post('/invite', [
  adminAuth,
  requirePermission('users.create'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role_id').isInt({ min: 1 }).withMessage('Role ID is required')
], handleAsync(async (req, res) => {
  validateRequest(req);

  const invitation = await userManagementService.createInvitation({
    email: req.body.email,
    roleId: req.body.role_id,
    invitedById: req.admin.id
  });

  successResponse(res, { invitation }, 201);
}));

/**
 * DELETE /invitations/:id
 * Cancel invitation
 * Requires: users.create permission
 */
router.delete('/invitations/:id', [
  adminAuth,
  requirePermission('users.create'),
  param('id').isInt({ min: 1 }).withMessage('Valid invitation ID is required')
], handleAsync(async (req, res) => {
  validateRequest(req);
  await userManagementService.cancelInvitation(parseInt(req.params.id), req.admin.id);
  successResponse(res, { message: 'Invitation cancelled' });
}));

/**
 * GET /:id
 * Get single user
 * Requires: users.view permission
 */
router.get('/:id', [
  adminAuth,
  requirePermission('users.view'),
  param('id').isInt({ min: 1 }).withMessage('Valid user ID is required')
], handleAsync(async (req, res) => {
  validateRequest(req);
  const user = await userManagementService.getAdminUserById(parseInt(req.params.id));
  res.json({ user: transformUser(user) });
}));

/**
 * PUT /:id
 * Update user
 * Requires: users.edit permission
 */
router.put('/:id', [
  adminAuth,
  requirePermission('users.edit'),
  param('id').isInt({ min: 1 }).withMessage('Valid user ID is required'),
  body('username').optional().trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role_id').optional().isInt({ min: 1 }).withMessage('Valid role ID is required'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean')
], handleAsync(async (req, res) => {
  validateRequest(req);

  const user = await userManagementService.updateAdminUser(
    parseInt(req.params.id),
    req.body,
    req.admin.id
  );

  successResponse(res, { user: transformUser(user), message: 'User updated successfully' });
}));

/**
 * POST /:id/deactivate
 * Deactivate user
 * Requires: users.delete permission
 */
router.post('/:id/deactivate', [
  adminAuth,
  requirePermission('users.delete'),
  param('id').isInt({ min: 1 }).withMessage('Valid user ID is required')
], handleAsync(async (req, res) => {
  validateRequest(req);
  await userManagementService.deactivateAdminUser(parseInt(req.params.id), req.admin.id);
  successResponse(res, { message: 'User deactivated successfully' });
}));

/**
 * POST /:id/reset-password
 * Reset user password
 * Requires: super_admin role
 */
router.post('/:id/reset-password', [
  adminAuth,
  requireSuperAdmin(),
  param('id').isInt({ min: 1 }).withMessage('Valid user ID is required')
], handleAsync(async (req, res) => {
  validateRequest(req);
  const result = await userManagementService.resetAdminPassword(parseInt(req.params.id), req.admin.id);
  successResponse(res, { message: 'Password reset email sent', ...result });
}));

module.exports = router;
