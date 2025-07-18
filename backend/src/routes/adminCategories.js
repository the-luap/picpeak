const express = require('express');
const { body, validationResult } = require('express-validator');
const { db, logActivity } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { adminAuth } = require('../middleware/auth-enhanced-v2');
const router = express.Router();

// Get all global categories
router.get('/global', adminAuth, async (req, res) => {
  try {
    const categories = await db('photo_categories')
      .where('is_global', formatBoolean(true))
      .orderBy('name', 'asc');
    
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get categories for a specific event (global + event-specific)
router.get('/event/:eventId', adminAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const categories = await db('photo_categories')
      .where(function() {
        this.where('is_global', formatBoolean(true))
          .orWhere('event_id', eventId);
      })
      .orderBy('is_global', 'desc')
      .orderBy('name', 'asc');
    
    res.json(categories);
  } catch (error) {
    console.error('Error fetching event categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create a new category
router.post('/', adminAuth, [
  body('name').notEmpty().withMessage('Category name is required'),
  body('slug').optional(),
  body('is_global').optional().isBoolean(),
  body('event_id').optional().isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, slug, is_global = true, event_id = null } = req.body;
    
    // Generate slug if not provided
    const categorySlug = slug || name.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    // Check if slug already exists for this scope
    const existing = await db('photo_categories')
      .where('slug', categorySlug)
      .where(function() {
        if (is_global) {
          this.where('is_global', formatBoolean(true));
        } else {
          this.where('event_id', event_id);
        }
      })
      .first();
    
    if (existing) {
      return res.status(400).json({ error: 'Category with this slug already exists' });
    }
    
    // Create category
    const insertResult = await db('photo_categories').insert({
      name,
      slug: categorySlug,
      is_global,
      event_id: is_global ? null : event_id
    }).returning('id');
    
    const categoryId = insertResult[0]?.id || insertResult[0];
    
    const category = await db('photo_categories').where('id', categoryId).first();
    
    // Log activity
    await logActivity('category_created', 
      { categoryName: name, isGlobal: is_global },
      event_id,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );
    
    res.json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update a category
router.put('/:id', adminAuth, [
  body('name').notEmpty().withMessage('Category name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { id } = req.params;
    const { name } = req.body;
    
    const category = await db('photo_categories').where('id', id).first();
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    await db('photo_categories')
      .where('id', id)
      .update({
        name,
        slug: name.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
      });
    
    const updated = await db('photo_categories').where('id', id).first();
    
    // Log activity
    await logActivity('category_updated',
      { categoryName: name },
      category.event_id,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete a category
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await db('photo_categories').where('id', id).first();
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if category has photos
    const photoCount = await db('photos').where('category_id', id).count('id as count').first();
    if (photoCount.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with photos. Please reassign photos first.' 
      });
    }
    
    await db('photo_categories').where('id', id).delete();
    
    // Log activity
    await logActivity('category_deleted',
      { categoryName: category.name },
      category.event_id,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;