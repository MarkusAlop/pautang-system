FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Build Svelte frontend
RUN npm run build

# Expose server port
EXPOSE 3000
ENV PORT=3000

# Start server
CMD ["node", "server/index.js"]
