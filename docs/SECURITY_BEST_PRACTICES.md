# Security Best Practices for PicPeak

## JWT Secret Management

### Generating Secure Secrets

Always generate cryptographically secure random secrets for JWT signing:

```bash
# Generate a 64-character hex string (256 bits)
openssl rand -hex 32

# Alternative: Generate a base64 string
openssl rand -base64 32

# Alternative: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Environment-Specific Secrets

**NEVER use the same JWT secret across different environments!**

- **Development**: Use the secure secret in `docker-compose.yml`
- **Staging**: Generate a unique secret for staging
- **Production**: Generate a unique secret for production

### Secret Requirements

1. **Minimum Length**: 32 characters (enforced by application)
2. **Recommended Length**: 64 characters (256 bits)
3. **Character Set**: Use hex or base64 encoding
4. **Uniqueness**: Each environment must have a unique secret

### What NOT to Do

❌ **Never commit real secrets to version control**
```bash
# Bad - real secret in code
JWT_SECRET=my-actual-production-secret
```

❌ **Never use predictable or weak secrets**
```bash
# Bad examples
JWT_SECRET=secret123
JWT_SECRET=mycompanyname
JWT_SECRET=password
JWT_SECRET=your-secret-key
```

❌ **Never share secrets between environments**
```bash
# Bad - same secret everywhere
DEV_JWT_SECRET=same-secret
PROD_JWT_SECRET=same-secret
```

### Secure Secret Storage

#### For Local Development
- Docker Compose files can contain development secrets
- These should still be secure random values

#### For Production
1. **Environment Variables**
   ```bash
   # Set via secure environment
   export JWT_SECRET=$(openssl rand -hex 32)
   ```

2. **Secret Management Services**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Kubernetes Secrets

3. **CI/CD Integration**
   - Store secrets in CI/CD platform's secret storage
   - Never log or echo secrets in build scripts

### Secret Rotation

Implement a secret rotation strategy:

1. **Regular Rotation**: Rotate secrets every 90 days
2. **Incident Response**: Rotate immediately if compromised
3. **Graceful Rotation**: Support multiple valid secrets during transition

### Monitoring and Alerts

1. **Startup Validation**: Application refuses to start without proper JWT_SECRET
2. **Length Warnings**: Warnings for secrets shorter than 32 characters
3. **Default Detection**: Critical error if default secret is detected

## Additional Security Measures

### Password Requirements
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, and special characters
- Check against common password lists
- Implement password strength meter

### Session Security
- Implement token expiration (24 hours for admin, configurable for galleries)
- Add refresh token mechanism
- Implement token revocation
- Use secure session storage (Redis in production)

### API Security
- Rate limiting on all endpoints
- Extra strict limits on authentication endpoints
- CSRF protection for state-changing operations
- Input validation on all user inputs

### File Upload Security
- Validate file types by content, not just extension
- Implement virus scanning
- Limit file sizes
- Sanitize filenames
- Store files outside web root

### Database Security
- Use parameterized queries (Knex.js handles this)
- Validate and sanitize all inputs
- Implement query timeouts
- Use least-privilege database users

### HTTPS and Headers
- Always use HTTPS in production
- Implement security headers:
  - Strict-Transport-Security
  - X-Frame-Options
  - X-Content-Type-Options
  - Content-Security-Policy
  - X-XSS-Protection

### Logging and Monitoring
- Log authentication attempts
- Monitor for suspicious patterns
- Never log sensitive data (passwords, tokens)
- Implement audit trails for admin actions

## Security Checklist for Deployment

- [ ] Generate unique JWT_SECRET for environment
- [ ] Verify JWT_SECRET meets minimum requirements
- [ ] Store secrets securely (not in code)
- [ ] Enable HTTPS
- [ ] Configure security headers
- [ ] Set up rate limiting
- [ ] Enable audit logging
- [ ] Test authentication flows
- [ ] Verify file upload restrictions
- [ ] Check database query security

## Incident Response

If a security incident occurs:

1. **Immediate Actions**
   - Rotate all secrets
   - Review access logs
   - Disable compromised accounts

2. **Investigation**
   - Analyze logs for unauthorized access
   - Check for data exfiltration
   - Review code changes

3. **Recovery**
   - Deploy security patches
   - Force password resets if needed
   - Notify affected users

4. **Prevention**
   - Update security practices
   - Implement additional monitoring
   - Conduct security audit