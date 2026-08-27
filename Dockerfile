# Use official Playwright image with all Node & browser dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.49.1-noble

# Set working directory
WORKDIR /app

# Copy package manifests first to leverage Docker layer caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose server port
EXPOSE 3000

# Set environment variable defaults
ENV PORT=3000
ENV NODE_ENV=production

# Start Express API server
CMD ["node", "src/server.js"]