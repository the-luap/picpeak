#!/usr/bin/env node

const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const knex = require('knex');
const db = knex({
  client: process.env.DB_CLIENT || 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'picpeak',
    password: process.env.DB_PASSWORD || 'picpeak',
    database: process.env.DB_NAME || 'picpeak_dev'
  }
});

async function setAdminPassword() {
  try {
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db('admin_users')
      .where('username', 'admin')
      .update({
        password_hash: hashedPassword,
        updated_at: new Date()
      });
    
    console.log('✅ Admin password set to: admin123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting password:', error);
    process.exit(1);
  }
}

setAdminPassword();
