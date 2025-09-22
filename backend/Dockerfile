FROM node:20-alpine AS builder

# Add build arguments
ARG CACHEBUST=1
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Add labels for GitHub Container Registry
LABEL org.opencontainers.image.source="https://github.com/the-luap/picpeak"
LABEL org.opencontainers.image.description="PicPeak Backend Service"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling and postgresql-client for database checks
RUN apk add --no-cache dumb-init postgresql-client

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Make wait script executable
RUN chmod +x wait-for-db.sh

# Create necessary directories
RUN mkdir -p storage/events/active storage/events/archived storage/thumbnails data logs && \
    chown -R nodejs:nodejs storage data logs

USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["./wait-for-db.sh", "node", "server.js"]
