# Production Deployment Guide

This guide explains how to deploy PicPeak in production behind a reverse proxy like Traefik.

## Environment Configuration

### Frontend Configuration

For production deployment behind a reverse proxy (Traefik, Nginx, etc.), the frontend should use relative URLs to automatically inherit the protocol (HTTPS) and domain.

1. Copy the production environment template:
   ```bash
   cp frontend/.env.production.example frontend/.env.production
   ```

2. Set the API URL to use relative path:
   ```env
   # frontend/.env.production
   VITE_API_URL=/api
   ```

   This ensures all API calls will use the same domain and protocol as the frontend.

### Backend Configuration

Ensure your backend `.env` file has the correct URLs:
```env
# backend/.env
FRONTEND_URL=https://yourdomain.com
ADMIN_URL=https://yourdomain.com
```

## Docker Compose Production

When using Docker Compose in production:

1. Build with production environment:
   ```bash
   docker-compose -f docker-compose.prod.yml build --build-arg NODE_ENV=production
   ```

2. The frontend nginx configuration already includes proper proxy settings for:
   - `/api` → Backend API
   - `/photos` → Protected photo access
   - `/thumbnails` → Thumbnail images
   - `/uploads` → Public uploads (logos, favicons)

## Traefik Configuration

Example Traefik labels for docker-compose:

```yaml
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.picpeak.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.picpeak.entrypoints=websecure"
      - "traefik.http.routers.picpeak.tls.certresolver=letsencrypt"
      - "traefik.http.services.picpeak.loadbalancer.server.port=80"
```

## Important Notes

1. **No Hardcoded URLs**: The application uses environment variables with relative URL fallbacks, making it production-ready.

2. **HTTPS Only**: When `VITE_API_URL=/api`, all requests will use the same protocol as the page (HTTPS in production).

3. **CORS Configuration**: The backend CORS is configured to accept requests from the URLs specified in `FRONTEND_URL` and `ADMIN_URL`.

4. **Static Assets**: All static assets (photos, thumbnails, uploads) are served through the nginx proxy, inheriting authentication headers.

## Verification

After deployment, verify:

1. Check browser console for any localhost URLs (there should be none)
2. Verify all API calls use HTTPS
3. Check that images load correctly with authentication
4. Test favicon and logo display

## Troubleshooting

If you see console errors about localhost:

1. Ensure `VITE_API_URL=/api` in frontend environment
2. Clear browser cache
3. Rebuild frontend with production environment:
   ```bash
   cd frontend
   npm run build
   ```

If images don't load:

1. Check that nginx proxy locations are configured
2. Verify authentication tokens are being sent
3. Check backend logs for authentication errors