const { db } = require('../src/database/db');

async function checkEmailTemplates() {
  try {
    console.log('=== Email Templates Check ===\n');
    
    // 1. Check table columns
    console.log('1. Checking email_templates table structure...');
    
    // Check which columns exist
    const columnChecks = [
      'subject', 'subject_en', 'subject_de',
      'body_html', 'body_html_en', 'body_html_de',
      'body_text', 'body_text_en', 'body_text_de'
    ];
    
    const existingColumns = [];
    for (const col of columnChecks) {
      const exists = await db.schema.hasColumn('email_templates', col);
      if (exists) existingColumns.push(col);
    }
    
    console.log('   Existing columns:', existingColumns.join(', '));
    
    // 2. Get all templates
    console.log('\n2. Current email templates:');
    const templates = await db('email_templates').select('*');
    
    for (const template of templates) {
      console.log(`\n   Template: ${template.template_key}`);
      console.log('   -------------------');
      
      // Check which fields have content
      const fields = ['subject', 'subject_en', 'subject_de', 
                     'body_html', 'body_html_en', 'body_html_de',
                     'body_text', 'body_text_en', 'body_text_de'];
      
      for (const field of fields) {
        if (template[field]) {
          const preview = template[field].substring(0, 50) + '...';
          console.log(`   ${field}: ${preview}`);
        }
      }
      
      // Check for German translations
      const hasGermanSubject = template.subject_de || template.body_html_de;
      console.log(`   Has German translation: ${hasGermanSubject ? 'YES' : 'NO'}`);
    }
    
    // 3. Summary
    console.log('\n3. Summary:');
    const totalTemplates = templates.length;
    const templatesWithGerman = templates.filter(t => t.subject_de || t.body_html_de).length;
    console.log(`   Total templates: ${totalTemplates}`);
    console.log(`   Templates with German: ${templatesWithGerman}`);
    console.log(`   Missing German: ${totalTemplates - templatesWithGerman}`);
    
    await db.destroy();
  } catch (error) {
    console.error('Error:', error);
    await db.destroy();
    process.exit(1);
  }
}

checkEmailTemplates();