# Render-Linear Sync

A tool that synchronizes Render deployments with Linear issue tracking. It automatically moves Linear tickets to "Done" status when applications are deployed.

## Features

- Monitors Render service deployments
- Detects new deployments across all services in your workspace
- Extracts Linear ticket references from Git commit messages
- Automatically updates Linear ticket statuses
- Tracks processed deploys in SQLite database
- Dry run mode for testing before making changes
- Webhook signature verification for security
- Professional structured logging

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
LINEAR_TICKET_PREFIXES=HQ,DEV,BUG
RENDER_WORKSPACE_ID=tea-xxxxxxxxxxxxxxxx
RENDER_BRANCH=main
WEBHOOK_SECRET=whsec_your-signing-secret-from-render
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DRY_RUN=true
DB_PATH=./render-linear-sync.db
PORT=3000
```

**Note**: `WEBHOOK_SECRET` is required in production mode. Set `DRY_RUN=true` to test without it.

### Getting API Keys

- **Linear API Key**: Go to [Linear Settings → API](https://linear.app/settings/api) and create a personal API key
- **Render API Key**: Go to [Render Dashboard → Account Settings → API Keys](https://dashboard.render.com/u/settings#api-keys) and create a new API key
- **Linear Ticket Prefixes**: Comma-separated list of ticket prefixes to look for in commit messages (e.g., `HQ,DEV,BUG`)
- **Render Workspace ID** (optional): Leave empty to monitor all workspaces, or set to a specific workspace ID
- **Render Branch** (optional): Branch to filter deployments (defaults to "main")
- **Webhook Secret** (required in production, optional in dry-run mode): Copy from Render webhook settings (starts with `whsec_`)
- **GitHub Token** (optional): GitHub personal access token for fetching commit history from merge commits. Required to extract tickets from all commits in a merge, not just the merge commit message. Create at [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) (no special permissions needed)

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
3. After creating the webhook, Render will generate a **Signing Secret** (it starts with `whsec_`)
4. Copy the signing secret from the webhook's Settings page in Render Dashboard
5. Add it to your `.env` file:

   ```env
   WEBHOOK_SECRET=whsec_your-signing-secret-from-render
   ```

6. **Important**: `WEBHOOK_SECRET` is **required in production mode** for security. The application will refuse to start without it unless `DRY_RUN=true` is set.

7. The webhook will automatically process deployments and update Linear tickets

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
  ghcr.io/nezdemkovski/render-linear-sync:latest

# Run in dry run mode (test without making changes)
docker run --rm \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -p 3000:3000 \
  -e DB_PATH=/app/data/render-linear-sync.db \
  -e DRY_RUN=true \
  -e PORT=3000 \
  ghcr.io/nezdemkovski/render-linear-sync:latest

# Run in interactive mode for debugging
docker run --rm -it --env-file .env ghcr.io/nezdemkovski/render-linear-sync:latest /bin/bash
```

**Note:** The `-v $(pwd)/data:/app/data` flag mounts a local directory to persist the SQLite database between container runs.

## How It Works

1. **Webhook receiver** listens for `deploy.ended` events from Render
2. **Verifies webhook signatures** to ensure requests are authentic (required in production)
3. **Filters by branch** (default: "main") to only process production deployments
4. **Tracks last processed commit** per service/branch in SQLite database
5. **Fetches commit range** from GitHub API between last and current deploy
6. **Extracts Linear ticket IDs** from all commits in the range (e.g., HQ-123, HQ-456)
7. **Checks ticket statuses** in Linear and moves them to "Done" if needed
8. **Updates last processed commit** to avoid re-processing

### Commit Range Tracking

The tool tracks the last successfully processed commit for each service/branch combination:

- **First deploy**: Processes only the current commit
- **Subsequent deploys**: Fetches all commits between the last processed commit and the current commit using GitHub's compare API (`/repos/{owner}/{repo}/compare/{base}...{head}`)
- **Merge commits**: Automatically captures all individual commits in the merge, not just the merge commit message
- **Multiple branches**: Each branch (dev, main, etc.) is tracked independently

**Example**: When you merge 10 commits from `dev` to `main`, the tool will extract tickets from all 10 commits, not just the merge commit message.

**GitHub Token**: Required for private repositories. For public repositories, it works without a token but with lower rate limits (60 requests/hour vs 5000/hour with token). Create a token at [GitHub Settings → Personal Access Tokens](https://github.com/settings/tokens) (no special permissions needed).

## Security

The application includes several security features:

- **Webhook Signature Verification**: All webhooks are verified using HMAC-SHA256 signatures. `WEBHOOK_SECRET` is required in production mode.
- **Structured Logging**: Logs are sanitized to prevent information disclosure. No sensitive data (API keys, signatures, full error details) is logged.
- **Input Validation**: Webhook payloads are validated before processing.
- **Parameterized Queries**: All database queries use parameterized statements to prevent SQL injection.

## Configuration

### Branch Filtering

By default, the webhook only processes deployments from the `main` branch. To change this:

```env
RENDER_BRANCH=master
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
- Allow running without `WEBHOOK_SECRET` (useful for local testing)

### Database

The tool uses SQLite to track all processed deploys. By default, the database is stored at `./render-linear-sync.db`.

You can customize the location:

```env
DB_PATH=/path/to/your/database.db
```

The database stores:

**Processed Tickets** (`processed_tickets` table):

- Deploy ID and service information
- Ticket ID and title
- Previous and new states
- Commit ID and message
- Timestamp of processing

**Last Processed Commits** (`last_processed_commits` table):

- Service ID and branch
- Last successfully processed commit SHA
- Timestamp of last update

This allows the tool to fetch only new commits since the last deploy, ensuring all tickets from merged commits are captured.

### Ticket Prefixes

**Required**: Configure which ticket prefixes to look for in commit messages using the `LINEAR_TICKET_PREFIXES` environment variable:

```bash
LINEAR_TICKET_PREFIXES=HQ,DEV,BUG
```

This is a comma-separated list of prefixes. The system will look for tickets matching any of these prefixes in commit messages (e.g., `HQ-1234`, `DEV-567`, `BUG-890`).

## Output Example

### Single Commit

```
[STARTUP] Starting Render-Linear Sync Webhook Receiver
[INFO] Listening on port 3000
[INFO] Webhook URL: http://0.0.0.0:3000/webhook

[INFO] Processing deploy webhook: api-service (evt-abc123)
[INFO] Found 1 ticket(s): HQ-1944 in 1 commit(s)
[INFO] Checking 1 Linear tickets...
[SUCCESS] Issue HQ-1944 moved to Done
[SUCCESS] 1 tickets moved to Done
```

### Merge Commit (Multiple Commits)

```
[INFO] Processing deploy webhook: noona-api (evt-d5eiccadbo4c738qvol0)
[INFO] Fetching commits between abc123 and def456
[INFO] Found 5 commit(s) in range
[INFO] Found 3 ticket(s): HQ-100, HQ-101, HQ-102 in 5 commit(s)
[INFO] Checking 3 Linear tickets...
[SUCCESS] Issue HQ-100 moved to Done
[SUCCESS] Issue HQ-101 moved to Done
[SUCCESS] Issue HQ-102 is already in Done state
[SUCCESS] 2 tickets moved to Done
[SUCCESS] 1 tickets are already completed/announced
```
