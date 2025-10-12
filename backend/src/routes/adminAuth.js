const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { db, logActivity } = require('../database/db');
const { adminAuth } = require('../middleware/auth-enhanced-v2');
const { endSession } = require('../middleware/sessionTimeout');
const { validatePasswordStrength } = require('../utils/passwordGenerator');
const router = express.Router();

// Change password
router.post('/change-password', [
  adminAuth,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 12 }).withMessage('New password must be at least 12 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.admin.id; // Changed from req.user.id to req.admin.id

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet security requirements',
        details: passwordValidation.messages
      });
    }

    // Get user from database
    const user = await db('admin_users')
      .where('id', userId)
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password with more rounds
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password and clear must_change_password flag
    await db('admin_users')
      .where('id', userId)
      .update({
        password_hash: newPasswordHash,
        must_change_password: false,
        updated_at: new Date()
      });

    // Log activity
    await logActivity('password_changed', 
      { admin_id: userId }, 
      null,
      { type: 'admin', id: userId, name: user.username }
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Update admin profile
router.put('/profile', [
  adminAuth,
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('email').trim().isEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email } = req.body;
    const userId = req.admin.id;

    // Check for email conflicts
    const existingEmail = await db('admin_users')
      .where('email', email)
      .whereNot('id', userId)
      .first();

    if (existingEmail) {
      return res.status(409).json({ error: 'Email is already in use by another admin' });
    }

    // Check username conflict (if multiple admins are supported)
    const existingUsername = await db('admin_users')
      .where('username', username)
      .whereNot('id', userId)
      .first();

    if (existingUsername) {
      return res.status(409).json({ error: 'Username is already in use by another admin' });
    }

    await db('admin_users')
      .where('id', userId)
      .update({
        username,
        email,
        updated_at: new Date()
      });

    const updatedUser = await db('admin_users')
      .select('id', 'username', 'email', 'must_change_password')
      .where('id', userId)
      .first();

    await logActivity(
      'admin_profile_updated',
      { admin_id: userId, updated_fields: ['username', 'email'] },
      null,
      { type: 'admin', id: userId, name: username }
    );

    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Admin profile update error:', error);
    res.status(500).json({ error: 'Failed to update admin profile' });
  }
});

// Logout
router.post('/logout', adminAuth, async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      // End the session
      endSession(token);
    }
    
    // Log activity
    await logActivity('admin_logout', 
      { admin_id: req.admin.id }, 
      null,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

module.exports = router;
