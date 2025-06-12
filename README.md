# ArgoCD-Linear Sync

A tool that synchronizes ArgoCD deployments with Linear issue tracking. It automatically moves Linear tickets to "Done" status when applications are deployed.

## Features

- 🔄 Monitors ArgoCD application deployments
- 📊 Analyzes Chart.lock changes to detect version updates
- 🔍 Extracts Linear ticket references from Git commit messages
- 🎫 Automatically updates Linear ticket statuses

## Prerequisites

- [Bun](https://bun.sh) runtime
- Linear API key
- GitHub Personal Access Token
- ArgoCD credentials

## Installation

### Local Development

```bash
# Install dependencies
bun install

# Copy environment template
cp env.example .env

# Edit .env with your credentials
```

### Docker

```bash
# Build the Docker image
docker build -t argocd-linear-sync .

# Or use the npm script
bun run docker:build
```

## Environment Variables

Create a `.env` file with the following variables:

```env
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ARGOCD_URL=https://argocd.example.com
ARGOCD_USER=your-username
ARGOCD_PASSWORD=your-password
```

### Getting API Keys

- **Linear API Key**: Go to [Linear Settings → API](https://linear.app/settings/api) and create a personal API key
- **GitHub Token**: Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) and create a token with `repo` scope
- **ArgoCD**: Use your ArgoCD username and password

## Usage

### Local Development

```bash
# Run in development mode (with file watching)
bun run dev

# Run once
bun run start
```

### Docker

```bash
# Run with .env file
docker run --rm --env-file .env argocd-linear-sync

# Run with individual environment variables
docker run --rm \
  -e LINEAR_API_KEY=your_key \
  -e GITHUB_TOKEN=your_token \
  -e ARGOCD_URL=https://argocd.example.com \
  -e ARGOCD_USER=your_username \
  -e ARGOCD_PASSWORD=your_password \
  argocd-linear-sync

# Run in interactive mode for debugging
docker run --rm -it --env-file .env argocd-linear-sync /bin/bash
```

## How It Works

1. **Connects to ArgoCD** and retrieves application deployment information
2. **Compares revisions** to detect changes between current and previous deployments
3. **Analyzes Chart.lock** changes to identify which applications were updated
4. **Fetches commit history** from GitHub for each changed application
5. **Extracts Linear ticket IDs** from commit messages (e.g., HQ-123, HQ-456)
6. **Checks ticket statuses** in Linear and moves them to "Done" if needed

## Configuration

### Ticket Prefixes

Configure which ticket prefixes to look for in `src/helpers/linear.ts`:

```typescript
const TICKET_PREFIXES = ["HQ", "DEV", "BUG"]; // Add your prefixes
```

## Output Example

```
🚀 staging | OutOfSync | 0be94433...00d18444
📊 8 apps changed: noona-api, noona-web, timatal, noona-messaging
📝 92 commits found
⚠️ 2 repos not found or commits not accessible: private-repo, archived-repo
🎫 17 tickets: HQ-117, HQ-118, HQ-1269, HQ-1944, HQ-2070, HQ-2071

🔍 Checking 17 Linear tickets...
🔄 [DRY RUN] Would move HQ-1944 to Done (currently: PR merged)
✅ 16 tickets are already completed/announced
🔄 1 tickets would be moved to Done (DRY RUN)
```
