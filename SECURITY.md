# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of PicPeak seriously. If you have discovered a security vulnerability, please follow these steps:

### 1. **Do NOT create a public GitHub issue**

### 2. Email us at security@example.com with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. You can expect:
- Acknowledgment within 48 hours
- Regular updates on our progress
- Credit in the fix announcement (unless you prefer to remain anonymous)

## Security Measures

PicPeak implements several security measures:

### Authentication & Authorization
- JWT-based authentication with secure token storage
- bcrypt password hashing with configurable rounds
- Role-based access control for admin functions
- Session timeout management

### Input Validation
- All user inputs are validated and sanitized
- SQL injection prevention through parameterized queries
- XSS protection via Content Security Policy
- File upload restrictions and validation

### Rate Limiting
- API rate limiting to prevent abuse
- Brute force protection on authentication endpoints
- Configurable limits per endpoint

### Data Protection
- HTTPS enforcement in production
- Secure cookie settings
- CORS configuration
- Sensitive data encryption

### Infrastructure
- Regular dependency updates
- Security headers (HSTS, X-Frame-Options, etc.)
- Activity logging for audit trails
- Automated backups

## Best Practices for Deployment

1. **Always use HTTPS** in production
2. **Change default passwords** immediately
3. **Keep dependencies updated** regularly
4. **Configure firewall rules** appropriately
5. **Monitor logs** for suspicious activity
6. **Backup regularly** and test restoration

## Vulnerability Disclosure

We believe in responsible disclosure. Once a vulnerability is fixed:

1. We'll publish a security advisory
2. Credit researchers (with permission)
3. Detail the impact and mitigation steps
4. Release patches for all supported versions

## Contact

- Security issues: security@example.com
- General support: https://github.com/the-luap/picpeak/issues

Thank you for helping keep PicPeak and its users safe!