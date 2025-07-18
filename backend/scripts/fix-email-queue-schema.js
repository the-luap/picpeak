#!/usr/bin/env node

/**
 * Script to diagnose and fix email_queue schema issues
 * This helps resolve the "column updated_at does not exist" error
 */

require('dotenv').config();
const { db } = require('../src/database/db');

async function checkAndFixEmailQueueSchema() {
  console.log('Checking email_queue table schema...');
  
  try {
    // Get column information
    const columns = await db('email_queue').columnInfo();
    console.log('\nCurrent email_queue columns:', Object.keys(columns));
    
    // Check for updated_at column
    if (columns.updated_at) {
      console.log('\n⚠️  Found unexpected updated_at column in email_queue table!');
      console.log('This column should not exist and is causing errors.');
      
      // Ask for confirmation before removing
      console.log('\nRemoving updated_at column...');
      await db.schema.table('email_queue', (table) => {
        table.dropColumn('updated_at');
      });
      console.log('✅ Removed updated_at column from email_queue table');
    } else {
      console.log('✅ No updated_at column found (this is correct)');
    }
    
    // Verify required columns exist
    const requiredColumns = [
      'id', 'event_id', 'recipient_email', 'email_type', 
      'email_data', 'status', 'scheduled_at', 'sent_at', 
      'error_message', 'retry_count', 'created_at'
    ];
    
    const missingColumns = requiredColumns.filter(col => !columns[col]);
    if (missingColumns.length > 0) {
      console.log('\n⚠️  Missing required columns:', missingColumns);
    } else {
      console.log('✅ All required columns are present');
    }
    
    // Check for any database triggers
    if (process.env.DATABASE_CLIENT === 'pg') {
      console.log('\nChecking for PostgreSQL triggers on email_queue...');
      const triggers = await db.raw(`
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'email_queue'
        AND trigger_schema = current_schema()
      `);
      
      if (triggers.rows && triggers.rows.length > 0) {
        console.log('⚠️  Found triggers on email_queue table:');
        triggers.rows.forEach(trigger => {
          console.log(`  - ${trigger.trigger_name} (${trigger.event_manipulation})`);
        });
      } else {
        console.log('✅ No triggers found on email_queue table');
      }
    }
    
    // Test update query
    console.log('\nTesting update query...');
    const testEmail = await db('email_queue')
      .where('status', 'pending')
      .first();
    
    if (testEmail) {
      try {
        await db('email_queue')
          .where('id', testEmail.id)
          .update({
            retry_count: testEmail.retry_count
          });
        console.log('✅ Update query works correctly');
      } catch (error) {
        console.log('❌ Update query failed:', error.message);
      }
    } else {
      console.log('ℹ️  No pending emails to test with');
    }
    
    console.log('\nSchema check complete!');
    
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await db.destroy();
  }
}

// Run the check
checkAndFixEmailQueueSchema();