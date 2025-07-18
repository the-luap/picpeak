const express = require('express');
const { body, validationResult } = require('express-validator');
const { db, logActivity } = require('../database/db');
const { adminAuth } = require('../middleware/auth-enhanced-v2');
const router = express.Router();

// Get all CMS pages
router.get('/pages', adminAuth, async (req, res) => {
  try {
    const pages = await db('cms_pages').select('*').orderBy('slug', 'asc');
    res.json(pages);
  } catch (error) {
    console.error('Error fetching CMS pages:', error);
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

// Get a single CMS page
router.get('/pages/:slug', adminAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const page = await db('cms_pages').where('slug', slug).first();
    
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    res.json(page);
  } catch (error) {
    console.error('Error fetching CMS page:', error);
    res.status(500).json({ error: 'Failed to fetch page' });
  }
});

// Update a CMS page
router.put('/pages/:slug', adminAuth, [
  body('title_en').optional().isString(),
  body('title_de').optional().isString(),
  body('content_en').optional().isString(),
  body('content_de').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { slug } = req.params;
    const { title_en, title_de, content_en, content_de } = req.body;
    
    const page = await db('cms_pages').where('slug', slug).first();
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    // Update the page
    await db('cms_pages')
      .where('slug', slug)
      .update({
        title_en,
        title_de,
        content_en,
        content_de,
        updated_at: new Date()
      });
    
    const updated = await db('cms_pages').where('slug', slug).first();
    
    // Log activity
    await logActivity('cms_page_updated',
      { page: slug },
      null,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating CMS page:', error);
    res.status(500).json({ error: 'Failed to update page' });
  }
});

module.exports = router;