# ArgoCD-Linear Sync

A tool that synchronizes ArgoCD deployments with Linear issue tracking. It automatically moves Linear tickets to "Done" status when applications are deployed.

## Features

- 🔄 Monitors ArgoCD application deployments
- 📊 Analyzes Chart.lock changes to detect version updates
- 🔍 Extracts Linear ticket references from Git commit messages
- 🎫 Automatically updates Linear ticket statuses
- 💾 Tracks processed tickets in SQLite database
- 🧪 Dry run mode for testing before making changes

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
ARGOCD_APP_NAME=staging
DRY_RUN=true
DB_PATH=./argocd-linear-sync.db
CRON_ENABLED=false
CRON_INTERVAL_MINUTES=5
```

### Getting API Keys

- **Linear API Key**: Go to [Linear Settings → API](https://linear.app/settings/api) and create a personal API key
- **GitHub Token**: Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) and create a token with `repo` scope
- **ArgoCD**: Use your ArgoCD username and password

## Usage

### Local Development

```bash
# Run once (single execution)
bun run start

# Run in cron mode (continuous with scheduled intervals)
CRON_ENABLED=true CRON_INTERVAL_MINUTES=5 bun run start

# Run in development mode (with file watching)
bun run dev
```

### Docker

```bash
# Run once with .env file and persistent database
docker run --rm \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -e DB_PATH=/app/data/argocd-linear-sync.db \
  argocd-linear-sync

# Run in cron mode (continuous, every 5 minutes)
docker run -d \
  --name argocd-linear-sync \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -e DB_PATH=/app/data/argocd-linear-sync.db \
  -e CRON_ENABLED=true \
  -e CRON_INTERVAL_MINUTES=5 \
  argocd-linear-sync

# Run in dry run mode (test without making changes)
docker run --rm \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -e DB_PATH=/app/data/argocd-linear-sync.db \
  -e DRY_RUN=true \
  argocd-linear-sync

# Run with individual environment variables
docker run --rm \
  -e LINEAR_API_KEY=your_key \
  -e GITHUB_TOKEN=your_token \
  -e ARGOCD_URL=https://argocd.example.com \
  -e ARGOCD_USER=your_username \
  -e ARGOCD_PASSWORD=your_password \
  -e ARGOCD_APP_NAME=staging \
  -e DRY_RUN=true \
  -v $(pwd)/data:/app/data \
  -e DB_PATH=/app/data/argocd-linear-sync.db \
  argocd-linear-sync

# Run in interactive mode for debugging
docker run --rm -it --env-file .env argocd-linear-sync /bin/bash
```

**Note:** The `-v $(pwd)/data:/app/data` flag mounts a local directory to persist the SQLite database between container runs.

## How It Works

1. **Connects to ArgoCD** and retrieves application deployment information
2. **Compares revisions** to detect changes between current and previous deployments
3. **Analyzes Chart.lock** changes to identify which applications were updated
4. **Fetches commit history** from GitHub for each changed application
5. **Extracts Linear ticket IDs** from commit messages (e.g., HQ-123, HQ-456)
6. **Checks ticket statuses** in Linear and moves them to "Done" if needed

## Configuration

### Cron Mode

Run the tool continuously on a schedule:

```bash
# In .env file
CRON_ENABLED=true
CRON_INTERVAL_MINUTES=5

# Or as environment variables
CRON_ENABLED=true CRON_INTERVAL_MINUTES=10 bun run start
```

When cron mode is enabled:

- The tool runs immediately on startup
- Then runs automatically every X minutes (configurable)
- Keeps running until you stop it (Ctrl+C)

When cron mode is disabled (default):

- The tool runs once and exits
- Suitable for manual runs or external cron jobs

### Dry Run Mode

Test the tool without making actual changes to Linear:

```bash
# Set in .env file
DRY_RUN=true

# Or as environment variable
DRY_RUN=true bun run start
```

When dry run is enabled, the tool will:

- Show what tickets would be moved
- Not save anything to the database
- Not actually update Linear ticket statuses

### Database

The tool uses SQLite to track all processed tickets. By default, the database is stored at `./argocd-linear-sync.db`.

You can customize the location:

```env
DB_PATH=/path/to/your/database.db
```

The database stores:

- Ticket ID and title
- Previous and new states
- Git revision information (from/to)
- GitHub authors (who worked on the ticket)
- Timestamp of processing

### Ticket Prefixes

Configure which ticket prefixes to look for in `src/helpers/linear.ts`:

```typescript
const TICKET_PREFIXES = ["HQ", "DEV", "BUG"]; // Add your prefixes
```

## Output Example

```
📊 Database initialized at ./argocd-linear-sync.db
🧪 DRY RUN MODE - No changes will be made to Linear tickets
🚀 staging | OutOfSync | 0be94433...00d18444
📊 8 apps changed: noona-api, noona-web, timatal, noona-messaging
📝 92 commits found
⚠️ 2 repos not found or commits not accessible: private-repo, archived-repo
🎫 17 tickets: HQ-117, HQ-118, HQ-1269, HQ-1944, HQ-2070, HQ-2071

🔍 Checking 17 Linear tickets...
🔄 [DRY RUN] Would move HQ-1944 (Fix login button styling) to Done (currently: PR merged)
✅ 16 tickets are already completed/announced
🔄 1 tickets would be moved to Done (DRY RUN)
```
