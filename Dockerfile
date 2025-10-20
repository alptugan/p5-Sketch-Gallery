# Use Node.js 20 LTS with Alpine for smaller image size
FROM node:20-alpine

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy all project files
COPY . .

# Build the admin UI and config
RUN pnpm build

# Expose the port (Railway will override with PORT env var)
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
