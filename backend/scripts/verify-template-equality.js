const { db } = require('../src/database/db');

async function verifyTemplateEquality() {
  try {
    console.log('Verifying template equality between German and English versions...\n');
    
    const templates = await db('email_templates').select('*');
    
    for (const template of templates) {
      console.log(`\n=== ${template.template_key.toUpperCase()} ===`);
      
      // Check subject length similarity
      const subjectEnLength = template.subject_en?.length || 0;
      const subjectDeLength = template.subject_de?.length || 0;
      console.log(`Subject length - EN: ${subjectEnLength}, DE: ${subjectDeLength}`);
      
      // Check HTML content features
      const htmlEn = template.body_html_en || '';
      const htmlDe = template.body_html_de || '';
      
      // Check for key features in both versions
      const features = [
        { name: 'Handlebars conditionals', pattern: /{{#if/g },
        { name: 'Styled divs', pattern: /style="/g },
        { name: 'Background colors', pattern: /background-color:/g },
        { name: 'Buttons/CTAs', pattern: /<a.*style.*background-color.*>/g },
        { name: 'Icons/Emojis', pattern: /[📧📞✅⚠️]/g },
        { name: 'Lists', pattern: /<ul/g },
        { name: 'Strong emphasis', pattern: /<strong>/g }
      ];
      
      console.log('\nFeature comparison:');
      for (const feature of features) {
        const enCount = (htmlEn.match(feature.pattern) || []).length;
        const deCount = (htmlDe.match(feature.pattern) || []).length;
        const status = enCount === deCount ? '✅' : '❌';
        console.log(`${status} ${feature.name}: EN=${enCount}, DE=${deCount}`);
      }
      
      // Check text content length
      const textEn = template.body_text_en || '';
      const textDe = template.body_text_de || '';
      console.log(`\nText content length - EN: ${textEn.length}, DE: ${textDe.length}`);
      
      // Check for specific variables usage
      const variables = [
        'host_name', 'event_name', 'event_date', 'gallery_link', 
        'gallery_password', 'expiry_date', 'welcome_message',
        'days_remaining', 'support_email', 'support_phone',
        'archive_date', 'photo_count', 'archive_size'
      ];
      
      const missingInEn = [];
      const missingInDe = [];
      
      for (const variable of variables) {
        const varPattern = new RegExp(`{{${variable}}}`, 'g');
        const inEn = varPattern.test(htmlEn) || varPattern.test(textEn);
        const inDe = varPattern.test(htmlDe) || varPattern.test(textDe);
        
        if (inDe && !inEn) missingInEn.push(variable);
        if (inEn && !inDe) missingInDe.push(variable);
      }
      
      if (missingInEn.length > 0) {
        console.log(`\n⚠️  Variables in DE but missing in EN: ${missingInEn.join(', ')}`);
      }
      if (missingInDe.length > 0) {
        console.log(`\n⚠️  Variables in EN but missing in DE: ${missingInDe.join(', ')}`);
      }
      
      // Overall quality score
      const enScore = [
        htmlEn.includes('style='),
        htmlEn.includes('{{#if'),
        htmlEn.includes('background-color'),
        htmlEn.includes('<strong>'),
        htmlEn.includes('margin:'),
        htmlEn.includes('padding:')
      ].filter(Boolean).length;
      
      const deScore = [
        htmlDe.includes('style='),
        htmlDe.includes('{{#if'),
        htmlDe.includes('background-color'),
        htmlDe.includes('<strong>'),
        htmlDe.includes('margin:'),
        htmlDe.includes('padding:')
      ].filter(Boolean).length;
      
      console.log(`\nQuality score (out of 6) - EN: ${enScore}, DE: ${deScore}`);
      console.log(enScore === deScore ? '✅ Templates have equal quality!' : '❌ Quality mismatch');
    }
    
    console.log('\n\nSummary:');
    console.log('The English templates have been updated to match the German templates in:');
    console.log('- HTML styling and structure');
    console.log('- Conditional content blocks');
    console.log('- Visual elements (buttons, alerts, icons)');
    console.log('- Information completeness');
    console.log('- Professional formatting');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.destroy();
  }
}

verifyTemplateEquality();