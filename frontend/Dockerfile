# Build stage
FROM node:20-alpine AS builder

# Add build arguments
ARG CACHEBUST=1
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Add labels for GitHub Container Registry
LABEL org.opencontainers.image.source="https://github.com/the-luap/picpeak"
LABEL org.opencontainers.image.description="PicPeak Frontend Application"
LABEL org.opencontainers.image.licenses="MIT"

# Upgrade npm to fix glob CVE-2025-64756 vulnerability
RUN npm install -g npm@latest

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage (use Alpine with patched libpng/c-ares)
FROM nginx:1.27-alpine

# Upgrade all packages to fix security vulnerabilities
# This ensures libpng >= 1.6.51 (fixes CVE-2025-64720, CVE-2025-65018, CVE-2025-64505, CVE-2025-64506)
# and c-ares >= 1.34.5 (fixes CVE-2025-31498)
RUN apk upgrade --no-cache

# Install runtime dependencies
RUN apk add --no-cache curl

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set permissions (nginx user already exists in nginx:alpine)
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Switch to non-root user
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
