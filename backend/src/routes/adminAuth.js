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