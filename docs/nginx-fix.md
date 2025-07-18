# Nginx Configuration Fix for Photo Authentication

If photos and thumbnails are not loading in gallery view but work in admin, it's likely that the Authorization header is being stripped by nginx or another reverse proxy.

## Common Issue

The `Authorization` header is often not passed through by default in nginx proxy configurations.

## Fix

Add these lines to your nginx configuration for the PicPeak location block:

```nginx
location / {
    proxy_pass http://localhost:3001;
    
    # Important: Pass the Authorization header
    proxy_pass_header Authorization;
    proxy_set_header Authorization $http_authorization;
    
    # Other standard proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Alternative Fix Using Traefik

If using Traefik, ensure headers are passed:

```yaml
services:
  picpeak:
    labels:
      - "traefik.http.middlewares.picpeak-headers.headers.customrequestheaders.Authorization="
```

## Testing

1. Check if Authorization header is reaching the backend:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" https://picpeak.yourdomain.com/thumbnails/test.jpg -v
   ```

2. Check nginx logs to see if the header is present:
   ```bash
   tail -f /var/log/nginx/access.log
   ```

## Docker Compose Fix

If using docker-compose with nginx proxy, add:

```yaml
environment:
  - NGINX_PROXY_PASS_HEADER=Authorization
```