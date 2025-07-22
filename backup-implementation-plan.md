# Comprehensive Backup & Restore Implementation Plan

## Introduction

This plan extends the existing backup system to include full database backups, S3/MinIO support, intelligent change detection, and complete restore functionality. The system will create versioned, encrypted backups with manifests for easy restoration while minimizing storage usage through incremental backups and smart scheduling.

---

## Phase 1: Enhanced Database Schema & Core Infrastructure

### Task 1.1: Create Enhanced Database Migration
**File:** `backend/migrations/030_enhance_backup_system.js`  
**Purpose:** Add tables for database backups, restore operations, and backup manifests

```sql
-- backup_manifests table
- id (primary key)
- backup_run_id (FK to backup_runs)
- manifest_version (e.g., "1.0.0")
- created_at
- database_dump_path
- database_checksum
- files_manifest (JSON with all file paths/checksums)
- metadata (JSON with system info, versions, etc.)

-- restore_operations table
- id (primary key)
- started_at
- completed_at
- status (pending, running, completed, failed)
- restore_type (full, partial, database_only, files_only)
- source_backup_id (FK to backup_runs)
- restored_by (FK to admin_users)
- error_message
- restore_log (detailed log)

-- backup_change_tracking table
- id (primary key)
- table_name
- last_change_timestamp
- row_count
- checksum
- last_backed_up
```

### Task 1.2: Add S3 Configuration Settings
**File:** Update migration `029_add_backup_service_tables.js`  
**Add settings:**
- `backup_s3_use_ssl` (boolean)
- `backup_s3_path_style` (for MinIO compatibility)
- `backup_encryption_enabled` (boolean)
- `backup_encryption_key` (encrypted storage)
- `backup_database_included` (boolean)
- `backup_incremental_enabled` (boolean)
- `backup_versioning_enabled` (boolean)
- `backup_versions_to_keep` (number)

---

## Phase 2: S3/MinIO Implementation

### Task 2.1: Install S3 Dependencies
**File:** `backend/package.json`  
**Command:** `npm install @aws-sdk/client-s3 @aws-sdk/lib-storage mime-types`  
**Purpose:** AWS SDK v3 for S3-compatible storage

### Task 2.2: Create S3 Storage Adapter
**File:** `backend/src/services/storage/s3Storage.js`  
**Implementation:**
```javascript
class S3StorageAdapter {
  constructor(config)
  connect() // Test connection
  uploadFile(localPath, remotePath, metadata)
  uploadStream(stream, remotePath, metadata)
  downloadFile(remotePath, localPath)
  listFiles(prefix)
  deleteFile(remotePath)
  getSignedUrl(remotePath, expiresIn)
  createMultipartUpload(remotePath) // For large files
  uploadPart(uploadId, partNumber, data)
  completeMultipartUpload(uploadId, parts)
}
```

### Task 2.3: Implement MinIO Compatibility Layer
**File:** `backend/src/services/storage/minioCompat.js`  
**Features:**
- Path-style URL handling
- Custom endpoint configuration
- SSL/TLS options
- Bucket creation if not exists

---

## Phase 3: Database Backup Integration

### Task 3.1: Create Database Dump Service
**File:** `backend/src/services/databaseBackup.js`  
**Implementation:**
```javascript
class DatabaseBackupService {
  async createBackup(format = 'sql') // sql or json
  async dumpSQLite(outputPath)
  async dumpPostgreSQL(outputPath)
  async compressBackup(inputPath, outputPath)
  async encryptBackup(inputPath, outputPath, key)
  async validateBackup(backupPath)
  async getTableChecksums() // For change detection
}
```

### Task 3.2: Implement Change Detection for Database
**File:** `backend/src/services/changeDetection.js`  
**Features:**
- Track table modifications using triggers
- Calculate table checksums
- Compare with last backup state
- Intelligent backup decision making

---

## Phase 4: Enhanced Backup Service

### Task 4.1: Refactor Backup Service for S3
**File:** `backend/src/services/backupService.js`  
**Modifications:**
- Add `performS3Backup()` implementation
- Support multipart uploads for large files
- Add progress tracking callbacks
- Implement retry logic with exponential backoff

### Task 4.2: Create Backup Manifest Generator
**File:** `backend/src/services/backupManifest.js`  
**Structure:**
```javascript
{
  version: "1.0.0",
  created_at: "2024-01-20T10:00:00Z",
  system_info: {
    app_version: "1.0.74",
    node_version: "18.x",
    database_type: "sqlite|postgresql"
  },
  database: {
    dump_file: "database/dump.sql.gz",
    checksum: "sha256:...",
    tables: { /* table info */ }
  },
  files: {
    count: 1234,
    total_size: 5678901234,
    entries: [
      {
        path: "events/active/...",
        checksum: "sha256:...",
        size: 12345,
        modified: "2024-01-20T09:00:00Z"
      }
    ]
  },
  settings: { /* app settings snapshot */ }
}
```

### Task 4.3: Implement Incremental Backup Logic
**File:** `backend/src/services/incrementalBackup.js`  
**Features:**
- Track changed files since last full backup
- Create incremental manifest
- Link to parent backup
- Merge incremental backups

---

## Phase 5: Restore Functionality

### Task 5.1: Create Restore Service
**File:** `backend/src/services/restoreService.js`  
**Implementation:**
```javascript
class RestoreService {
  async validateBackup(backupId)
  async prepareRestore(backupId, options)
  async restoreDatabase(manifestPath)
  async restoreFiles(manifestPath, options)
  async performFullRestore(backupId)
  async performPartialRestore(backupId, selections)
  async rollbackRestore(restoreId)
  async verifyRestore(restoreId)
}
```

### Task 5.2: Implement Safe Restore Process
**File:** `backend/src/services/restoreValidation.js`  
**Safety Features:**
- Pre-restore backup creation
- Validation checksums
- Atomic operations
- Rollback capability
- Post-restore verification

### Task 5.3: Create Restore CLI Tool
**File:** `backend/scripts/restore-backup.js`  
**Purpose:** Emergency restore without running application  
**Features:**
- Interactive mode
- Dry-run option
- Progress display
- Validation reports

---

## Phase 6: Admin API Extensions

### Task 6.1: Add Restore Endpoints
**File:** `backend/src/routes/adminBackup.js`  
**New Endpoints:**
```javascript
POST   /api/admin/backup/restore/validate
POST   /api/admin/backup/restore/start
GET    /api/admin/backup/restore/:id/status
POST   /api/admin/backup/restore/:id/cancel
GET    /api/admin/backup/manifests/:backupId
GET    /api/admin/backup/download/:backupId
```

### Task 6.2: Add S3 Management Endpoints
**File:** `backend/src/routes/adminBackup.js`  
**New Endpoints:**
```javascript
GET    /api/admin/backup/s3/buckets
GET    /api/admin/backup/s3/files
DELETE /api/admin/backup/s3/cleanup
POST   /api/admin/backup/s3/test-upload
```

---

## Phase 7: Frontend Implementation

### Task 7.1: Create Backup Management Page
**File:** `frontend/src/pages/admin/BackupManagement.jsx`  
**Components:**
- Backup configuration form
- Backup history table
- Manual backup trigger
- Restore interface
- Progress indicators

### Task 7.2: Create Backup Status Dashboard
**File:** `frontend/src/components/admin/BackupDashboard.jsx`  
**Features:**
- Real-time backup status
- Storage usage charts
- Backup success rate
- Next scheduled backup
- Recent backup/restore operations

### Task 7.3: Implement Restore Wizard
**File:** `frontend/src/components/admin/RestoreWizard.jsx`  
**Steps:**
1. Select backup to restore
2. Choose restore type (full/partial)
3. Select components (database/files/settings)
4. Review and confirm
5. Monitor progress
6. Verify results

---

## Phase 8: Background Job Enhancements

### Task 8.1: Implement Smart Scheduling
**File:** `backend/src/services/smartScheduler.js`  
**Features:**
- Skip backup if no changes detected
- Adaptive scheduling based on activity
- Priority queuing for critical backups
- Resource usage monitoring

### Task 8.2: Create Backup Monitor Service
**File:** `backend/src/services/backupMonitor.js`  
**Purpose:** Monitor backup health and alert on issues  
**Features:**
- Check last successful backup age
- Verify backup integrity periodically
- Monitor storage usage
- Alert on failures or anomalies

---

## Phase 9: Security & Encryption

### Task 9.1: Implement Backup Encryption
**File:** `backend/src/utils/encryption.js`  
**Features:**
- AES-256-GCM encryption
- Key derivation from master key
- Encrypted manifest headers
- Secure key storage

### Task 9.2: Add Access Control
**File:** `backend/src/middleware/backupAuth.js`  
**Features:**
- Separate permissions for backup/restore
- Audit logging for all operations
- IP whitelist for restore operations
- Two-factor authentication for restore

---

## Phase 10: Testing & Validation

### Task 10.1: Create Backup Test Suite
**File:** `backend/__tests__/services/backup.test.js`  
**Tests:**
- Unit tests for each backup method
- Integration tests with real S3/MinIO
- Database backup/restore cycles
- Encryption/decryption validation
- Manifest generation and parsing

### Task 10.2: Create Restore Test Suite
**File:** `backend/__tests__/services/restore.test.js`  
**Tests:**
- Full restore scenarios
- Partial restore validation
- Rollback testing
- Corruption recovery
- Cross-version compatibility

### Task 10.3: Create E2E Backup/Restore Tests
**File:** `backend/__tests__/e2e/backupRestore.test.js`  
**Scenarios:**
- Complete backup/restore cycle
- Disaster recovery simulation
- Performance benchmarks
- Storage optimization validation

---

## Phase 11: Documentation & Deployment

### Task 11.1: Create Backup Administrator Guide
**File:** `docs/backup-admin-guide.md`  
**Contents:**
- Configuration guide
- Best practices
- Troubleshooting
- Recovery procedures
- Performance tuning

### Task 11.2: Update Docker Configuration
**Files:** `docker-compose.yml`, `Dockerfile`  
**Changes:**
- Add S3/MinIO service for development
- Volume mappings for backups
- Environment variable templates
- Health checks for backup service

### Task 11.3: Create Backup Playbook
**File:** `docs/backup-playbook.md`  
**Scenarios:**
- Daily backup verification
- Disaster recovery steps
- Migration procedures
- Troubleshooting flowchart

---

## Implementation Order & Priority

### Critical Path (Must Have):
1. S3 Storage Adapter (Task 2.2)
2. Database Backup Service (Task 3.1)
3. Enhanced Backup Service (Task 4.1)
4. Basic Restore Service (Task 5.1)
5. Admin API Extensions (Task 6.1)
6. Backup Test Suite (Task 10.1)

### High Priority (Should Have):
1. Backup Manifest Generator (Task 4.2)
2. Change Detection (Task 3.2)
3. Frontend Backup Page (Task 7.1)
4. Encryption Implementation (Task 9.1)
5. Restore Wizard (Task 7.3)

### Nice to Have:
1. Incremental Backups (Task 4.3)
2. Smart Scheduling (Task 8.1)
3. Advanced Monitoring (Task 8.2)
4. MinIO Compatibility (Task 2.3)

---

## Configuration Examples

### S3 Configuration:
```javascript
{
  backup_destination_type: "s3",
  backup_s3_endpoint: "https://s3.amazonaws.com",
  backup_s3_bucket: "wedding-backups",
  backup_s3_access_key: "AKIA...",
  backup_s3_secret_key: "secret",
  backup_s3_region: "us-east-1",
  backup_s3_use_ssl: true,
  backup_s3_path_style: false
}
```

### MinIO Configuration:
```javascript
{
  backup_destination_type: "s3",
  backup_s3_endpoint: "https://minio.example.com:9000",
  backup_s3_bucket: "picpeak-backups",
  backup_s3_access_key: "minioadmin",
  backup_s3_secret_key: "minioadmin",
  backup_s3_region: "us-east-1",
  backup_s3_use_ssl: true,
  backup_s3_path_style: true // Required for MinIO
}
```

---

## Best Practices Implementation

1. **Change Detection**: Use database triggers and file checksums to detect changes
2. **Compression**: Always compress before encryption for better ratios
3. **Chunking**: Split large backups into manageable chunks
4. **Versioning**: Keep multiple backup versions with rotation
5. **Validation**: Verify every backup immediately after creation
6. **Monitoring**: Alert on backup failures within 5 minutes
7. **Testing**: Perform monthly restore drills
8. **Documentation**: Log every backup/restore operation with details

---

## Key Features of This Implementation

### Intelligent Change Detection
- Only backs up when changes are detected
- Tracks database modifications via checksums
- Monitors file system changes
- Reduces unnecessary backup operations

### Comprehensive Backup Scope
- Full database dumps (SQLite/PostgreSQL)
- All event photos and thumbnails
- Application settings and configuration
- Email templates and user data
- Complete system state capture

### Flexible Storage Options
- Local directory backup
- Remote server via rsync
- S3-compatible storage (AWS, MinIO, etc.)
- Encrypted storage for security
- Compression for space efficiency

### Robust Restore Capabilities
- Full system restore
- Partial restore (specific events/data)
- Point-in-time recovery
- Pre-restore validation
- Rollback on failure

### Enterprise-Grade Features
- Backup manifests for verification
- Incremental backup support
- Version retention policies
- Automated cleanup of old backups
- Comprehensive audit logging

This comprehensive plan provides a robust, enterprise-grade backup solution with full disaster recovery capabilities.