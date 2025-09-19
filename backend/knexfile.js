require('dotenv').config();

const path = require('path');

// Database configuration for different environments
const sqliteConnection = (filenameEnv) => ({
  filename: path.join(__dirname, filenameEnv || './data/photo_sharing.db')
});

const baseSqliteConfig = {
  client: 'sqlite3',
  connection: sqliteConnection(),
  useNullAsDefault: true,
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  }
};

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

  test: (() => {
    const client = process.env.DATABASE_CLIENT || 'sqlite3';
    const isPostgres = client === 'pg';

    return {
      ...baseSqliteConfig,
      client,
      useNullAsDefault: !isPostgres,
      connection: isPostgres
        ? {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_NAME || 'photo_sharing_test'
          }
        : sqliteConnection(process.env.TEST_DATABASE_PATH || './data/photo_sharing_test.db')
    };
  })(),

  production: {
    client: process.env.DATABASE_CLIENT || 'pg',
    // Support both Postgres and SQLite in production based on DATABASE_CLIENT
    connection: (process.env.DATABASE_CLIENT || 'pg') === 'pg'
      ? {
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
        }
      : {
          filename: path.join(__dirname, process.env.DATABASE_PATH || './data/photo_sharing.db')
        },
    useNullAsDefault: (process.env.DATABASE_CLIENT || 'pg') !== 'pg',
    pool: (process.env.DATABASE_CLIENT || 'pg') === 'pg'
      ? {
          min: 5,
          max: 25,
          acquireTimeoutMillis: 60000,
          createTimeoutMillis: 60000,
          idleTimeoutMillis: 30000,
          reapIntervalMillis: 1000,
          createRetryIntervalMillis: 200,
          propagateCreateError: false
        }
      : undefined,
    migrations: {
      directory: './migrations'
    },
    acquireConnectionTimeout: 60000
  }
};
const env = process.env.NODE_ENV || 'development';

module.exports = config[env] || config.development;
