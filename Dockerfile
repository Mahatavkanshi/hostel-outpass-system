# Multi-stage Dockerfile for Hostel Outpass System

# Stage 1: Backend
FROM node:18-alpine AS backend

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy backend source code
COPY backend/ ./

# Expose backend port
EXPOSE 5000

# Stage 2: Frontend (static files)
FROM nginx:alpine AS frontend

# Copy frontend files to nginx
COPY frontend/ /usr/share/nginx/html/

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Stage 3: Final production image
FROM node:18-alpine

WORKDIR /app

# Copy backend from build stage
COPY --from=backend /app/backend ./backend

# Install nginx for serving frontend (optional - can use separate containers)
# For this image, we'll focus on backend only

WORKDIR /app/backend

# Create uploads directory
RUN mkdir -p uploads

# Set environment to production
ENV NODE_ENV=production

# Expose backend port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:5000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "server.js"]
