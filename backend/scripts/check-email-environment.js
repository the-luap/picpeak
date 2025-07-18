const { db } = require('../src/database/db');

async function checkEmailEnvironment() {
  console.log('=== Email Environment Check ===\n');
  
  // 1. Check environment variables
  console.log('1. Environment Variables:');
  const envVars = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'SMTP_SECURE',
    'EMAIL_PROCESSOR_ENABLED',
    'NODE_ENV'
  ];
  
  envVars.forEach(varName => {
    const value = process.env[varName];
    if (varName.includes('PASS')) {
      console.log(`   ${varName}: ${value ? '***' : 'NOT SET'}`);
    } else {
      console.log(`   ${varName}: ${value || 'NOT SET'}`);
    }
  });
  
  // 2. Check database configuration
  console.log('\n2. Database Email Configuration:');
  try {
    const emailConfig = await db('email_configs').first();
    if (emailConfig) {
      console.log('   Email configuration found in database:');
      console.log(`   - SMTP Host: ${emailConfig.smtp_host}`);
      console.log(`   - SMTP Port: ${emailConfig.smtp_port}`);
      console.log(`   - SMTP User: ${emailConfig.smtp_user || 'NOT SET'}`);
      console.log(`   - SMTP Secure: ${emailConfig.smtp_secure}`);
      console.log(`   - From Address: ${emailConfig.smtp_from}`);
    } else {
      console.log('   ⚠️  No email configuration found in database!');
      console.log('   This will prevent the email processor from initializing.');
    }
  } catch (error) {
    console.log(`   ❌ Error reading email configuration: ${error.message}`);
  }
  
  // 3. Check if the email processor should be disabled
  console.log('\n3. Email Processor Status:');
  const isDisabled = process.env.EMAIL_PROCESSOR_ENABLED === 'false';
  if (isDisabled) {
    console.log('   ⚠️  Email processor is DISABLED via EMAIL_PROCESSOR_ENABLED=false');
  } else {
    console.log('   ✅ Email processor is enabled (default)');
  }
  
  // 4. Check pending emails
  console.log('\n4. Email Queue Status:');
  try {
    const pending = await db('email_queue')
      .where('status', 'pending')
      .count('* as count')
      .first();
    
    const failed = await db('email_queue')
      .where('status', 'failed')
      .where('retry_count', '>=', 3)
      .count('* as count')
      .first();
    
    const sent = await db('email_queue')
      .where('status', 'sent')
      .count('* as count')
      .first();
    
    console.log(`   - Pending emails: ${pending.count}`);
    console.log(`   - Failed emails (max retries): ${failed.count}`);
    console.log(`   - Sent emails: ${sent.count}`);
  } catch (error) {
    console.log(`   ❌ Error querying email queue: ${error.message}`);
  }
  
  // 5. Test database connection
  console.log('\n5. Database Connection:');
  try {
    await db.raw('SELECT 1');
    console.log('   ✅ Database connection successful');
  } catch (error) {
    console.log(`   ❌ Database connection failed: ${error.message}`);
  }
  
  // 6. Check for any recent errors
  console.log('\n6. Recent Email Errors:');
  try {
    const recentErrors = await db('email_queue')
      .whereNotNull('error_message')
      .orderBy('id', 'desc')
      .limit(3)
      .select('id', 'email_type', 'error_message', 'retry_count');
    
    if (recentErrors.length > 0) {
      recentErrors.forEach((email, index) => {
        console.log(`   ${index + 1}. Email ID ${email.id} (${email.email_type}):`);
        console.log(`      Retries: ${email.retry_count}`);
        console.log(`      Error: ${email.error_message}`);
      });
    } else {
      console.log('   No recent errors found');
    }
  } catch (error) {
    console.log(`   ❌ Error querying recent errors: ${error.message}`);
  }
  
  console.log('\n=== Environment check complete ===');
  console.log('\nRecommendations:');
  
  const emailConfig = await db('email_configs').first().catch(() => null);
  if (!emailConfig) {
    console.log('❗ Configure email settings in the admin panel or add email_configs record');
  }
  
  if (!process.env.SMTP_HOST && !emailConfig) {
    console.log('❗ Set SMTP environment variables or configure in database');
  }
  
  await db.destroy();
}

checkEmailEnvironment().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});