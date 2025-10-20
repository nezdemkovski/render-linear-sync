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
# - GITHUB_TOKEN: GitHub Personal Access Token with repo access
# - ARGOCD_URL: ArgoCD instance URL (e.g., https://argocd.example.com)
# - ARGOCD_USER: ArgoCD username
# - ARGOCD_PASSWORD: ArgoCD password
# - ARGOCD_APP_NAME: ArgoCD application name (e.g., staging, qa-netherlands)
# - DRY_RUN: Set to "true" for testing without making changes (optional)
# - DB_PATH: Path to SQLite database (optional, defaults to ./argocd-linear-sync.db)
# - CRON_ENABLED: Set to "true" to run continuously on a schedule (optional)
# - CRON_INTERVAL_MINUTES: Interval in minutes between runs when cron is enabled (optional, defaults to 5)

# Create a volume mount point for the database
VOLUME ["/app/data"]

# Set the entrypoint
ENTRYPOINT ["bun", "run", "start"] 