# Security Logging Documentation

## Overview
This document describes the comprehensive security logging implemented in the PicPeak application to track authentication failures, rate limiting, and suspicious activities.

## Log Files

### 1. **security.log**
- Location: `logs/security.log`
- Contains: All security-related events (authentication, rate limiting, suspicious activity)
- Max Size: 20MB with rotation (keeps 10 files)
- Format: JSON with timestamp

### 2. **error.log**
- Location: `logs/error.log`
- Contains: All error-level logs including auth failures
- Max Size: 10MB with rotation (keeps 5 files)

### 3. **combined.log**
- Location: `logs/combined.log`
- Contains: All logs (info, warn, error)
- Max Size: 50MB with rotation (keeps 10 files)

## Security Events Logged

### Rate Limiting
When rate limits are exceeded, the following is logged:
```json
{
  "timestamp": "2024-01-18 14:23:45.123",
  "level": "warn",
  "message": "Rate limit exceeded",
  "security": true,
  "ip": "192.168.1.1",
  "path": "/api/admin/login",
  "method": "POST",
  "authenticated": false,
  "userAgent": "Mozilla/5.0...",
  "referer": "https://app.example.com",
  "origin": "https://app.example.com",
  "headers": {
    "x-forwarded-for": "192.168.1.1",
    "x-real-ip": "192.168.1.1"
  },
  "requestUrl": "/api/admin/login",
  "rateLimitInfo": {
    "limit": 5,
    "current": 6,
    "remaining": 0,
    "resetTime": "2024-01-18T14:38:45.123Z"
  }
}
```

### Authentication Failures

#### Admin Login Failures
- Tracked in `login_attempts` table
- Logged with: IP address, username, user agent, timestamp
- Account lockout after 5 failures in 15 minutes

#### Gallery Password Failures
- Tracked in `access_logs` table with action='login_fail'
- Logged with: event_id, IP address, user agent
- Gallery lockout after 5 failures in 15 minutes

### JWT Validation Failures
```json
{
  "timestamp": "2024-01-18 14:23:45.123",
  "level": "warn",
  "message": "JWT validation failed",
  "ip": "192.168.1.1",
  "path": "/api/admin/events",
  "method": "GET",
  "userAgent": "Mozilla/5.0...",
  "error": "TokenExpiredError",
  "message": "jwt expired"
}
```

### Suspicious Activity
- Multiple IPs attempting login for same account
- Token usage from different IP than issued
- Token usage after password change
- Revoked token usage attempts

## Configuration Settings

The general limiter reads these keys from `app_settings` (cached for 60 seconds). There is no admin screen for them yet; they are set through `PUT /api/admin/settings/security/rate-limit` (all six fields required) or directly in the table, JSON-encoded. The defaults below are what applies when a key has no row — a fresh install has none. Note that the route only updates rows that already exist: on a fresh install it answers 200 without writing anything, so insert the six rows directly first.

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| rate_limit_enabled | true | - | Enable/disable rate limiting |
| rate_limit_window_minutes | 15 | 1-60 | Time window for rate limit |
| rate_limit_max_requests | 300 | 10-10000 | Per-IP budget for `/api/` requests that are not exempt |
| rate_limit_auth_max_requests | 5 | 1-100 | Per-IP budget of *failed* admin-login / gallery-verify attempts (own bucket) |
| rate_limit_skip_authenticated | true | - | Admin sessions are exempt; since v3.127.0-beta.0 a verified gallery viewer's image requests (thumbnail, preview, hero, photo) are exempt too |
| rate_limit_public_endpoints_only | false | - | Only rate limit `/api/public/*` and `/api/gallery/*` |

The limiter keys on the client IP as Express reports it, so behind a proxy `TRUST_PROXY` has to cover that proxy or every visitor shares one budget. Several people behind one NAT (an office, a household, carrier NAT) share a budget by design; before v3.127.0-beta.0 a large gallery could exhaust it for a single viewer, which surfaced as blank tiles with no error (issue 1287).

## Database Tables

### login_attempts
```sql
- id
- username
- ip_address
- user_agent
- success (boolean)
- created_at
```

### access_logs
```sql
- id
- event_id
- ip_address
- user_agent
- action ('view', 'download', 'login_success', 'login_fail')
- photo_id (nullable)
- created_at
```

## Environment Variables

- `LOG_LEVEL`: Set logging level (default: 'info')
- `LOG_TO_CONSOLE`: Enable console logging in production (default: false)

## Monitoring Recommendations

1. **Set up alerts for:**
   - Rate limit exceeded events (possible DDoS)
   - Multiple failed login attempts from same IP
   - Account lockout events
   - JWT validation failures spike

2. **Regular review:**
   - Check security.log for patterns
   - Review login_attempts table for brute force attempts
   - Monitor access_logs for suspicious gallery access patterns

3. **Log analysis tools:**
   - Use log aggregation tools (ELK stack, Splunk)
   - Set up dashboards for security metrics
   - Configure alerts for threshold breaches

## Production Deployment Notes

1. Ensure logs directory has proper permissions
2. Set up log rotation outside of application if needed
3. Consider shipping logs to centralized logging service
4. Monitor disk space for log files
5. Set `LOG_TO_CONSOLE=true` for container deployments

## Security Best Practices

1. Never log sensitive data (passwords, tokens)
2. Use generic error messages to prevent user enumeration
3. Clean up old login attempts regularly (7 days retention)
4. Monitor for unusual patterns in real-time
5. Keep rate limit settings appropriate for your usage