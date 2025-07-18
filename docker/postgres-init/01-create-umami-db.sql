-- Create umami database if it doesn't exist
-- This runs as the postgres superuser during initialization

SELECT 'CREATE DATABASE umami'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'umami')\gexec

-- Grant all privileges on umami database to the application user
GRANT ALL PRIVILEGES ON DATABASE umami TO "${POSTGRES_USER}";