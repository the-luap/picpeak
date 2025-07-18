const express = require('express');
const { db } = require('../database/db');
const router = express.Router();

// Get public CMS page
router.get('/pages/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { lang = 'en' } = req.query;
    
    const page = await db('cms_pages').where('slug', slug).first();
    
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    // Return the appropriate language version
    const title = lang === 'de' ? page.title_de : page.title_en;
    const content = lang === 'de' ? page.content_de : page.content_en;
    
    res.json({
      title,
      content,
      slug: page.slug,
      updated_at: page.updated_at
    });
  } catch (error) {
    console.error('Error fetching public CMS page:', error);
    res.status(500).json({ error: 'Failed to fetch page' });
  }
});

module.exports = router;