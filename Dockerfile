# Use Node.js Alpine image for smaller size
FROM node:20-alpine

# Install git and git-lfs for handling Git LFS files
RUN apk add --no-cache git git-lfs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Copy application code
COPY scripts/ ./scripts/
COPY src/ ./src/

# Create directories
RUN mkdir -p original optimized

# Default command runs the optimization
CMD ["node", "scripts/optimize-images.js"]