const { db } = require('../src/database/db');
const { processTemplate } = require('../src/services/emailProcessor');

async function testGermanEmails() {
  try {
    console.log('=== Testing German Email Templates ===\n');
    
    // Test variables
    const testVars = {
      host_name: 'Max Mustermann',
      event_name: 'Hochzeit Schmidt',
      event_date: '15.07.2024',
      gallery_link: 'https://example.com/gallery/test',
      gallery_password: 'test1234',
      expiry_date: '15.08.2024',
      days_remaining: '7',
      welcome_message: 'Herzlich willkommen zu unserer Hochzeitsgalerie!',
      archive_size: '250 MB',
      archive_date: '16.08.2024',
      photo_count: '347',
      admin_email: 'support@example.com',
      eventId: 1
    };
    
    const templates = await db('email_templates').select('*');
    
    for (const template of templates) {
      console.log(`\n========== ${template.template_key.toUpperCase()} ==========`);
      
      // Process German version
      const germanResult = await processGermanTemplate(template, testVars);
      
      console.log('\n--- GERMAN VERSION ---');
      console.log('Subject:', germanResult.subject);
      console.log('\nHTML Preview (first 500 chars):');
      console.log(germanResult.htmlBody.substring(0, 500) + '...\n');
      
      // Check for any remaining English text
      const englishWords = ['Dear', 'Gallery', 'Details:', 'Link:', 'Password:', 'days', 'Thank you'];
      const foundEnglish = englishWords.filter(word => 
        germanResult.htmlBody.includes(word) || germanResult.subject.includes(word)
      );
      
      if (foundEnglish.length > 0) {
        console.log('⚠️  WARNING: Found English words:', foundEnglish.join(', '));
      } else {
        console.log('✅ No English words found in German template');
      }
    }
    
    await db.destroy();
  } catch (error) {
    console.error('Error:', error);
    await db.destroy();
    process.exit(1);
  }
}

async function processGermanTemplate(template, variables) {
  // Process template as German
  const subjectField = 'subject_de';
  const htmlField = 'body_html_de';
  const textField = 'body_text_de';
  
  let subject = template[subjectField] || template.subject || '';
  let htmlBody = template[htmlField] || template.body_html || '';
  let textBody = template[textField] || template.body_text || '';
  
  // Replace variables
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    subject = subject.replace(regex, variables[key]);
    htmlBody = htmlBody.replace(regex, variables[key]);
    textBody = textBody.replace(regex, variables[key]);
  });
  
  // Handle conditionals (simplified)
  htmlBody = htmlBody.replace(/{{#if welcome_message}}[\s\S]*?{{\/if}}/g, (match) => {
    return variables.welcome_message ? match.replace(/{{#if welcome_message}}|{{\/if}}/g, '') : '';
  });
  
  return { subject, htmlBody, textBody };
}

testGermanEmails();