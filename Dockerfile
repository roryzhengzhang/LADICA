# Use Node.js LTS version as base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies
RUN npm install

# Copy .env file first (if it exists)
COPY .env* ./

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Expose ports for Next.js and WebSocket server
EXPOSE 3000
EXPOSE 5800

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5800
ENV HOST=0.0.0.0

# Start both the Next.js app and WebSocket server
CMD ["npm", "run", "dev"] 