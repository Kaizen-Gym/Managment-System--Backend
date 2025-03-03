# Use official Node.js 22 image as base
FROM node:22-alpine

# Set working directory in container
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
# --production flag to only install production dependencies
# ci is preferred for production builds over npm install
RUN npm ci --only=production

# Copy source code
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=5050

# Expose port
EXPOSE 5050

# Command to run the application
CMD ["node", "server.js"]

HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:5050/health || exit 1