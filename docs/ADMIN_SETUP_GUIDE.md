# Admin Setup Guide - Secure Password System

## Overview

PicPeak now uses a secure admin setup process that eliminates the default password vulnerability. When you first set up the application, a secure password is automatically generated for the admin account.

## Initial Setup Process

### 1. First Installation

When you run the database migrations for the first time:

```bash
cd backend
npm run migrate
```

The system will:
- Create an admin user with username `admin`
- Generate a secure, random password (e.g., `SwiftEagle3847!`)
- Display the credentials in the console
- Save the credentials to `ADMIN_CREDENTIALS.txt`

### 2. Retrieving Your Credentials

After setup, you can find your admin credentials in:
- **Console output** - Displayed immediately after setup
- **ADMIN_CREDENTIALS.txt** - File in the project root

**Example output:**
```
========================================
✅ Admin user created successfully!
========================================
Username: admin
Password: SwiftEagle3847!

⚠️  IMPORTANT:
1. Save these credentials securely
2. You will be required to change the password on first login
3. Credentials are also saved in: ADMIN_CREDENTIALS.txt
========================================
```

### 3. First Login

1. Navigate to the admin panel: `http://localhost:3001/admin`
2. Login with:
   - Username: `admin`
   - Password: (from ADMIN_CREDENTIALS.txt)
3. You will be prompted to change your password immediately

### 4. Password Requirements

When changing your password, it must meet these requirements:
- Minimum 12 characters long
- Contains uppercase letters (A-Z)
- Contains lowercase letters (a-z)
- Contains numbers (0-9)
- Contains special characters (!@#$%^&*()_+-=[]{}|;:,.<>?)
- Not a common password

## Security Features

### Generated Passwords
- Uses cryptographically secure random generation
- Human-readable format: `AdjectiveNoun####!`
- Example: `BrightMountain7823$`

### Password Storage
- Passwords are hashed using bcrypt with 12 rounds
- Original password is never stored in the database
- Credentials file should be deleted after noting the password

### Forced Password Change
- Admin must change password on first login
- System tracks `must_change_password` flag
- Cannot access admin features until password is changed

## Troubleshooting

### Lost Admin Password

If you lose the admin password before first login:

1. Delete the admin user from the database:
   ```sql
   DELETE FROM admin_users WHERE username = 'admin';
   ```

2. Run migrations again:
   ```bash
   npm run migrate
   ```

3. New credentials will be generated

### Password Change Issues

If you can't change your password:
- Ensure new password meets all requirements
- Check for detailed error messages
- Password strength validator provides specific feedback

### Can't Find Credentials File

If ADMIN_CREDENTIALS.txt is missing:
- Check the console output from when you ran migrations
- File is created in the backend directory root
- File might have been deleted for security (as recommended)
- Regenerate it by running `node scripts/reset-admin-password.js --force --credentials-file data/ADMIN_CREDENTIALS.txt`
- When using the unified `picpeak-setup.sh` installer for a reinstall, append `--force-admin-password-reset` to have the script perform the reset automatically

## Best Practices

1. **Immediate Action**
   - Change the generated password on first login
   - Use a password manager to store credentials
   - Delete ADMIN_CREDENTIALS.txt after noting the password

2. **Password Security**
   - Use unique passwords for each environment
   - Rotate passwords regularly (every 90 days)
   - Never share admin credentials

3. **Multiple Admins**
   - Create separate admin accounts for each person
   - Avoid sharing the main admin account
   - Use role-based access control when available

## Migration from Old System

If upgrading from the old system with hardcoded `admin123`:

1. The system will detect existing admin user
2. You must manually reset the password:
   ```bash
   # Run the password reset script
   node scripts/reset-admin-password.js
   ```

3. Follow the new secure password process

## Environment-Specific Setup

### Development
- Generated passwords are suitable for development
- Consider using simpler passwords for convenience
- Always use strong passwords in staging/production

### Production
- Generate new admin account for production
- Use extremely strong passwords (20+ characters)
- Enable two-factor authentication when available
- Regularly audit admin access logs

## Security Checklist

- [ ] Retrieved generated password from ADMIN_CREDENTIALS.txt
- [ ] Logged in successfully with generated password
- [ ] Changed password to a strong, unique password
- [ ] Deleted ADMIN_CREDENTIALS.txt file
- [ ] Stored new password in password manager
- [ ] Tested login with new password
- [ ] Set up additional admin accounts if needed
- [ ] Configured password policies for organization
