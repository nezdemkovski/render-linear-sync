# Render-Linear Sync

A tool that synchronizes Render deployments with Linear issue tracking. It automatically moves Linear tickets to "Done" status when applications are deployed.

## Features

- 🔄 Monitors Render service deployments
- 📊 Detects new deployments across all services in your workspace
- 🔍 Extracts Linear ticket references from Git commit messages
- 🎫 Automatically updates Linear ticket statuses
- 💾 Tracks processed deploys in SQLite database
- 🧪 Dry run mode for testing before making changes

## Prerequisites

- [Bun](https://bun.sh) runtime
- Linear API key
- Render API key

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
docker build -t render-linear-sync .

# Or use the npm script
bun run docker:build
```

## Environment Variables

Create a `.env` file with the following variables:

```env
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RENDER_API_KEY=rnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RENDER_WORKSPACE_ID=tea-xxxxxxxxxxxxxxxx
RENDER_BRANCH=main
DRY_RUN=true
DB_PATH=./render-linear-sync.db
PORT=3000
```

### Getting API Keys

- **Linear API Key**: Go to [Linear Settings → API](https://linear.app/settings/api) and create a personal API key
- **Render API Key**: Go to [Render Dashboard → Account Settings → API Keys](https://dashboard.render.com/u/settings#api-keys) and create a new API key
- **Render Workspace ID** (optional): Leave empty to monitor all workspaces, or set to a specific workspace ID
- **Render Branch** (optional): Branch to filter deployments (defaults to "main")

## Usage

### Local Development

```bash
# Start the webhook server
bun run start

# Or in development mode (with file watching)
bun run dev
```

The server will start on port 3000 (or the port specified in `PORT` env var) and listen for webhook events from Render.

### Setting Up Render Webhooks

1. Go to [Render Dashboard → Integrations → Webhooks](https://dashboard.render.com/webhooks)
2. Create a new webhook with:
   - **URL**: `https://your-domain.com/webhook` (or use a service like ngrok for local testing)
   - **Event**: `deploy.ended`
3. The webhook will automatically process deployments and update Linear tickets

### Docker Compose (Local Build)

If you can't access GHCR, use the local build compose file:

```bash
# Build and start the service
docker compose -f docker-compose.local.yml up -d --build

# View logs
docker compose -f docker-compose.local.yml logs -f

# Stop the service
docker compose -f docker-compose.local.yml down
```

### Docker CLI

```bash
# Run webhook server with .env file and persistent database
docker run -d \
  --name render-linear-sync \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -p 3000:3000 \
  -e DB_PATH=/app/data/render-linear-sync.db \
  -e PORT=3000 \
  ghcr.io/noona-hq/render-linear-sync:latest

# Run in dry run mode (test without making changes)
docker run --rm \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -p 3000:3000 \
  -e DB_PATH=/app/data/render-linear-sync.db \
  -e DRY_RUN=true \
  -e PORT=3000 \
  ghcr.io/noona-hq/render-linear-sync:latest

# Run in interactive mode for debugging
docker run --rm -it --env-file .env ghcr.io/noona-hq/render-linear-sync:latest /bin/bash
```

**Note:** The `-v $(pwd)/data:/app/data` flag mounts a local directory to persist the SQLite database between container runs.

## How It Works

1. **Webhook receiver** listens for `deploy.ended` events from Render
2. **Filters by branch** (default: "main") to only process production deployments
3. **Fetches deploy details** from Render API to get commit messages
4. **Extracts Linear ticket IDs** from commit messages (e.g., HQ-123, HQ-456)
5. **Checks ticket statuses** in Linear and moves them to "Done" if needed
6. **Tracks processed deploys** in SQLite database to avoid duplicates

## Configuration

### Branch Filtering

By default, the webhook only processes deployments from the `main` branch. To change this:

```env
RENDER_BRANCH=production
```

Or set to empty to process all branches:

```env
RENDER_BRANCH=
```

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

The tool uses SQLite to track all processed deploys. By default, the database is stored at `./render-linear-sync.db`.

You can customize the location:

```env
DB_PATH=/path/to/your/database.db
```

The database stores:

- Deploy ID and service information
- Ticket ID and title
- Previous and new states
- Commit ID and message
- Timestamp of processing

### Ticket Prefixes

Configure which ticket prefixes to look for in `src/helpers/linear.ts`:

```typescript
const TICKET_PREFIXES = ["HQ", "DEV", "BUG"]; // Add your prefixes
```

## Output Example

```
🚀 Starting Render-Linear Sync Webhook Receiver...
📡 Listening on port 3000
🔗 Webhook URL: http://localhost:3000/webhook

🚀 Processing deploy webhook: noona-api (evt-abc123)
🎫 Found 1 ticket(s): HQ-1944 in commit: Fix login button styling
🔍 Checking Linear ticket: HQ-1944
🔄 [DRY RUN] Would move HQ-1944 (Fix login button styling) to Done (currently: In Progress)
✅ Webhook processed successfully
```
