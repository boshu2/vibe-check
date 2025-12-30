# Minimal Alpine-based Dockerfile for vibe-check CI/CD
FROM node:20-alpine

# Install git (required for vibe-check)
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built distribution files
COPY dist/ ./dist/

# Copy bin directory for CLI executables
COPY bin/ ./bin/

# Set entrypoint to vibe-check CLI
ENTRYPOINT ["node", "dist/cli.js"]

# Default command (can be overridden)
CMD ["--help"]
