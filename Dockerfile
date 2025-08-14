# Multi-stage Dockerfile for Next.js with SQLite
# Optimized for Fly.io deployment

# Stage 1: Dependencies
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Stage 2: Builder
FROM node:18-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for public environment variables
ARG NEXT_PUBLIC_ELEVENLABS_API_KEY
ENV NEXT_PUBLIC_ELEVENLABS_API_KEY=$NEXT_PUBLIC_ELEVENLABS_API_KEY

ARG NEXT_PUBLIC_ELEVENLABS_AGENT_ID
ENV NEXT_PUBLIC_ELEVENLABS_AGENT_ID=$NEXT_PUBLIC_ELEVENLABS_AGENT_ID

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app

# Install SQLite for database operations
RUN apk add --no-cache sqlite

# Set production environment
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create data directory for SQLite volume
RUN mkdir -p /data && chown -R nextjs:nodejs /data

# Create initialization script (database will be created on first run)
RUN echo '#!/bin/sh\n\
# Initialize database on first run if needed\n\
if [ ! -f /data/database.sqlite ]; then\n\
  echo "Creating database on first run..."\n\
  # Database will be auto-created by the app\n\
fi\n\
exec "$@"' > /app/init-db.sh && chmod +x /app/init-db.sh

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set port for Fly.io
ENV PORT 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Start command with database initialization
CMD if [ ! -f /data/database.sqlite ] && [ -f /tmp/database.sqlite ]; then \
      echo "Initializing database..." && \
      cp /tmp/database.sqlite /data/database.sqlite && \
      echo "Database initialized"; \
    fi && \
    node server.js