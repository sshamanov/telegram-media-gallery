# Production Dockerfile for Telegram Gallery
# Based on node:20-alpine as per project decision

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev) for building
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runtime

WORKDIR /app

# Install runtime dependencies if needed
# (Add any required system packages here as discovered)
# RUN apk add --no-cache <packages>

# Copy built assets and package files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Install only production dependencies for runtime
RUN npm ci --only=production

# Expose port (Vite preview uses 4173 by default)
EXPOSE 4173

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4173/ || exit 1

# Serve static files using Vite preview (production server)
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]