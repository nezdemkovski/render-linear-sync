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

# Set the entrypoint
ENTRYPOINT ["bun", "run", "start"] 