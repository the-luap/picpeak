# Backup Version Tracking Implementation

## Overview
Version tracking has been added to the backup system to ensure safe restoration by tracking application versions, Node.js versions, and database schema versions at the time of backup.

## Implementation Details

### 1. Database Schema Changes (Migration 034)

Added version tracking columns to backup tables:

#### `database_backup_runs` table:
- `app_version` - Application version from package.json
- `node_version` - Node.js runtime version
- `db_schema_version` - Latest migration name
- `environment_info` - JSON with additional environment details

#### `backup_runs` table:
- `app_version` - Application version
- `node_version` - Node.js version
- `db_schema_version` - Database schema version
- `manifest_info` - Summary of manifest information

#### New `restore_history` table:
Tracks all restore attempts with comprehensive version information:
- Backup versions vs current versions
- Compatibility check results
- Warnings and errors
- Restore outcome

### 2. Version Information Captured

During each backup, the system now records:
- **Application Version**: From `package.json` (e.g., "1.0.77")
- **Node.js Version**: Runtime version (e.g., "v18.17.0")
- **Database Schema**: Latest migration file (e.g., "034_add_version_to_backups.js")
- **Environment Info**: Platform, architecture, environment mode

### 3. Backup Services Updated

#### Database Backup Service (`databaseBackup.js`):
- Records version info when creating backups
- Includes versions in statistics JSON
- New method: `checkVersionCompatibility()` for restore safety
- New method: `getCurrentSchemaVersion()` to track migrations

#### File Backup Service (`backupService.js`):
- Records version info in backup_runs table
- Integrates with manifest system
- Stores manifest summary with version details

### 4. Existing Manifest System

The `backupManifest.js` already provides comprehensive version tracking:
- Application version and Node.js version
- System information (OS, platform, architecture)
- Database schema version
- Detailed file and database metadata

### 5. Version Compatibility Checking

When restoring, the system can now:
- Compare backup version vs current version
- Detect major/minor version differences
- Identify schema mismatches
- Provide warnings and recommendations

### 6. Configuration Settings

New backup settings for version control:
- `backup_require_version_match` - Enforce exact version matching
- `backup_allow_minor_version_mismatch` - Allow same major version
- `backup_warn_on_version_mismatch` - Show warnings on mismatch
- `backup_check_schema_compatibility` - Validate schema versions

## Usage

### Creating Backups
Backups automatically capture version information - no changes needed to existing backup workflows.

### Checking Version Before Restore

1. **For Database Backups**:
```javascript
const compatibility = await databaseBackupService.checkVersionCompatibility({
  app_version: '1.0.75',
  node_version: 'v16.14.0',
  db_schema_version: '032_add_feedback.js'
});

if (!compatibility.compatible) {
  console.error('Version mismatch:', compatibility.errors);
}
```

2. **For File Backups**:
Check the manifest file which contains all version information:
```bash
cat /backup/path/manifest-backup-20250122-123456.json | jq '.application'
```

### Restore History
All restore attempts are logged in the `restore_history` table with:
- Version compatibility results
- Warnings encountered
- Success/failure status
- Who performed the restore

## Best Practices

1. **Always Check Compatibility**: Before restoring, verify version compatibility
2. **Document Version Changes**: Keep changelog updated with breaking changes
3. **Test Restores**: Regularly test restore procedures in staging
4. **Monitor Warnings**: Even if compatible, review warnings before proceeding
5. **Keep Backups Organized**: Label backups with version info in filename

## Migration Instructions

1. Run the new migration:
```bash
cd backend
npm run migrate
```

2. Existing backups will show "unknown" for version fields
3. New backups will automatically include version information
4. The system remains backward compatible with old backups

## Troubleshooting

### Version Mismatch Errors
- Check current app version: `cat backend/package.json | grep version`
- Check Node version: `node --version`
- Check latest migration: `SELECT name FROM knex_migrations ORDER BY id DESC LIMIT 1`

### Restore Failures
- Review `restore_history` table for detailed error messages
- Check version compatibility warnings
- Consider using same version environment for critical restores

## Future Enhancements

1. **Automated Version Matching**: Docker containers with specific versions
2. **Migration Rollback**: Support for downgrading schema safely
3. **Version Matrix**: Compatibility matrix for different version combinations
4. **Restore Wizard**: UI for guided restore with compatibility checks

---

**Implementation Date**: January 2025
**Current Version**: 1.0.77
**Status**: Production Ready