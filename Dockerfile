FROM oven/bun:latest AS base

WORKDIR /app

# Install dependencies
COPY package.json .
COPY bun.lock .
COPY tsconfig.json .
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ src/
COPY types/ types/

# Set environment variables
ENV NODE_ENV=production

# Required environment variables (pass via --env-file .env or -e flags):
# - LINEAR_API_KEY: Linear API key from https://linear.app/settings/api
# - RENDER_API_KEY: Render API key from https://dashboard.render.com/u/settings#api-keys
# - RENDER_WORKSPACE_ID: Render workspace ID (optional, defaults to all workspaces)
# - RENDER_BRANCH: Branch to filter deployments (optional, defaults to "main")
# - DRY_RUN: Set to "true" for testing without making changes (optional)
# - DB_PATH: Path to SQLite database (optional, defaults to ./render-linear-sync.db)
# - PORT: Port for webhook server (optional, defaults to 3000)

# Create a volume mount point for the database
VOLUME ["/app/data"]

# Set the entrypoint
ENTRYPOINT ["bun", "run", "start"] 