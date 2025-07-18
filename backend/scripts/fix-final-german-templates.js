const { db } = require('../src/database/db');

async function fixFinalGermanTemplates() {
  try {
    console.log('Fixing remaining English words in German templates...\n');
    
    // Get all templates
    const templates = await db('email_templates').select('*');
    
    for (const template of templates) {
      let updated = false;
      let updates = {};
      
      // Fix subject_de
      if (template.subject_de) {
        updates.subject_de = template.subject_de;
      }
      
      // Fix body_html_de
      if (template.body_html_de) {
        let html = template.body_html_de;
        
        // Replace English words with German
        html = html.replace(/Gallery-Details:/g, 'Galerie-Details:');
        html = html.replace(/Galerie-Details:/g, 'Galerie-Details:');
        html = html.replace(/Details:/g, 'Details:');
        html = html.replace(/Link:/g, 'Link:');
        html = html.replace(/Gallery-Link:/g, 'Galerie-Link:');
        html = html.replace(/Galerie-Link:/g, 'Galerie-Link:');
        html = html.replace(/Archive-Details:/g, 'Archiv-Details:');
        html = html.replace(/Archiv-Details:/g, 'Archiv-Details:');
        
        if (html !== template.body_html_de) {
          updates.body_html_de = html;
          updated = true;
        }
      }
      
      // Fix body_text_de
      if (template.body_text_de) {
        let text = template.body_text_de;
        
        text = text.replace(/Gallery-Details:/g, 'Galerie-Details:');
        text = text.replace(/Galerie-Details:/g, 'Galerie-Details:');
        text = text.replace(/Details:/g, 'Details:');
        text = text.replace(/Link:/g, 'Link:');
        text = text.replace(/Gallery-Link:/g, 'Galerie-Link:');
        text = text.replace(/Galerie-Link:/g, 'Galerie-Link:');
        text = text.replace(/Archive-Details:/g, 'Archiv-Details:');
        text = text.replace(/Archiv-Details:/g, 'Archiv-Details:');
        
        if (text !== template.body_text_de) {
          updates.body_text_de = text;
          updated = true;
        }
      }
      
      // Also update the non-language-specific fields to match German
      if (template.body_html_de) {
        updates.body_html = template.body_html_de;
      }
      if (template.body_text_de) {
        updates.body_text = template.body_text_de;
      }
      if (template.subject_de) {
        updates.subject = template.subject_de;
      }
      
      if (updated || Object.keys(updates).length > 0) {
        await db('email_templates')
          .where('template_key', template.template_key)
          .update(updates);
        console.log(`✅ Updated ${template.template_key}`);
      } else {
        console.log(`⏭️  No changes needed for ${template.template_key}`);
      }
    }
    
    console.log('\nDone!');
    await db.destroy();
  } catch (error) {
    console.error('Error:', error);
    await db.destroy();
    process.exit(1);
  }
}

fixFinalGermanTemplates();