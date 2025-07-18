const { db } = require('../src/database/db');

async function checkGermanTemplates() {
  try {
    console.log('=== German Email Template Content Check ===\n');
    
    const templates = await db('email_templates').select('*');
    
    for (const template of templates) {
      console.log(`\nTemplate: ${template.template_key}`);
      console.log('=====================================');
      
      // Check German subject
      console.log('\nGERMAN SUBJECT:');
      console.log(template.subject_de || 'MISSING');
      
      // Check if German HTML body has English content
      console.log('\nGERMAN HTML BODY:');
      const germanHtml = template.body_html_de || '';
      
      // Check for English phrases in German template
      const englishPhrases = [
        'Dear', 'Gallery', 'has been', 'Your photo', 'successfully',
        'Details:', 'Link:', 'Password:', 'Expires:', 'Event Date:',
        'Thank you', 'Best regards', 'View Gallery', 'days'
      ];
      
      const foundEnglish = englishPhrases.filter(phrase => 
        germanHtml.toLowerCase().includes(phrase.toLowerCase())
      );
      
      if (foundEnglish.length > 0) {
        console.log('⚠️  Found English phrases in German template:', foundEnglish.join(', '));
      }
      
      // Show first 500 chars of German HTML
      console.log(germanHtml.substring(0, 500) + '...\n');
      
      // Check German text body
      console.log('GERMAN TEXT BODY:');
      const germanText = template.body_text_de || '';
      console.log(germanText.substring(0, 300) + '...\n');
    }
    
    await db.destroy();
  } catch (error) {
    console.error('Error:', error);
    await db.destroy();
    process.exit(1);
  }
}

checkGermanTemplates();