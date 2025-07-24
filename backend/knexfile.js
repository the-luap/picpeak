require('dotenv').config();

const path = require('path');

// Database configuration for different environments
const config = {
  development: {
    client: process.env.DATABASE_CLIENT || 'sqlite3',
    connection: process.env.DATABASE_CLIENT === 'pg' ? {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'photo_sharing'
    } : {
      filename: path.join(__dirname, process.env.DATABASE_PATH || './data/photo_sharing.db')
    },
    useNullAsDefault: process.env.DATABASE_CLIENT !== 'pg',
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },

  production: {
    client: process.env.DATABASE_CLIENT || 'pg',
    connection: {
      host: process.env.DB_HOST || 'db',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'picpeak',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'picpeak',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      // Connection stability settings
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 0
    },
    pool: {
      min: 5,
      max: 25,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 60000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false
    },
    migrations: {
      directory: './migrations'
    },
    acquireConnectionTimeout: 60000
  }
};

module.exports = config[process.env.NODE_ENV || 'development'];