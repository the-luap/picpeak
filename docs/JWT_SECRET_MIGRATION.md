# JWT_SECRET Security Fix - Migration Guide

## Overview

A critical security vulnerability has been fixed where the application would fall back to a hardcoded JWT secret (`'your-secret-key'`) if the `JWT_SECRET` environment variable was not set. This has been addressed by:

1. Adding startup validation that requires `JWT_SECRET` to be set
2. Removing all hardcoded fallback values
3. Ensuring the secret meets minimum security requirements

## Changes Made

### 1. Added Environment Validation (`backend/src/config/validateEnv.js`)
- The server now validates critical environment variables at startup
- If `JWT_SECRET` is missing or set to the insecure default, the server will refuse to start
- Warns if `JWT_SECRET` is less than 32 characters (recommended minimum)

### 2. Updated Server Startup (`backend/server.js`)
- Added validation call immediately after loading environment variables
- Ensures all routes and middleware have access to validated configuration

### 3. Removed Hardcoded Fallbacks (`backend/src/routes/protectedImages.js`)
- Removed `|| 'your-secret-key'` fallback from lines 15 and 27
- Functions now rely on the validated `JWT_SECRET` from environment

## Migration Steps for Production

### Before Deployment

1. **Verify JWT_SECRET is set in production**:
   ```bash
   # Check if JWT_SECRET is set
   echo $JWT_SECRET
   ```

2. **Ensure JWT_SECRET is secure**:
   - Must NOT be `'your-secret-key'` 
   - Should be at least 32 characters long
   - Should be randomly generated

3. **Generate a secure JWT_SECRET if needed**:
   ```bash
   # Generate a secure 64-character secret
   openssl rand -hex 32
   ```

### Deployment Process

1. **Update environment variables** (if needed):
   ```bash
   # Example for .env file
   JWT_SECRET=your-secure-64-character-random-string-here
   ```

2. **Deploy the updated code**

3. **Monitor startup logs** to ensure no validation errors:
   ```
   ✓ Environment validation passed
   ✓ Server running on port 3000
   ```

### Rollback Plan

If the deployment fails due to missing `JWT_SECRET`:

1. **Quick Fix** (temporary):
   - Set `JWT_SECRET` environment variable to a secure value
   - Restart the application

2. **Full Rollback** (if needed):
   - Revert to previous version
   - Set `JWT_SECRET` properly before attempting deployment again

## Verification

After deployment, verify the fix is working:

1. **Check server logs** for successful startup
2. **Test authentication** to ensure JWT tokens are working
3. **Verify image protection** routes are functioning

## Security Considerations

- **Never** commit JWT_SECRET to version control
- **Rotate** JWT_SECRET periodically
- **Use different** secrets for different environments (dev, staging, production)
- **Monitor** for authentication failures that might indicate token issues

## Troubleshooting

### Server won't start
- **Error**: "Missing required environment variable: JWT_SECRET"
- **Solution**: Set the JWT_SECRET environment variable

### JWT_SECRET rejection
- **Error**: "JWT_SECRET is set to the insecure default value"
- **Solution**: Change JWT_SECRET from 'your-secret-key' to a secure value

### Authentication failures after deployment
- **Cause**: Existing tokens were signed with old secret
- **Solution**: Users will need to re-authenticate to get new tokens

## Support

If you encounter issues during migration:
1. Check the server logs for specific error messages
2. Verify environment variables are properly set
3. Ensure the JWT_SECRET value doesn't contain special characters that might need escaping