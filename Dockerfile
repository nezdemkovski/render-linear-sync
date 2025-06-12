FROM oven/bun:latest AS base

WORKDIR /app

# Install dependencies
COPY package.json .
COPY bun.lock .
COPY tsconfig.json .
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ src/

# Set environment variables
ENV NODE_ENV=production

# Set the entrypoint
ENTRYPOINT ["bun", "run", "start"] 