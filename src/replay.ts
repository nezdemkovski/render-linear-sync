import { getCommitsBetween } from "./helpers/github";
import { extractTicketsFromCommit, processLinearTickets } from "./helpers/linear";

// Administrative CLI only: no HTTP replay endpoint and no checkpoint rewrites.
const [repository, from, to] = Bun.argv.slice(2).filter((arg) => arg !== "--dry-run");
if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !from || !to ||
    !/^[0-9a-f]{40}$/i.test(from) || !/^[0-9a-f]{40}$/i.test(to)) {
  throw new Error("Usage: bun run src/replay.ts owner/repo <full-from-SHA> <full-to-SHA> [--dry-run]");
}
const apiKey = process.env.LINEAR_API_KEY;
if (!apiKey) throw new Error("LINEAR_API_KEY is required");
const [owner, repo] = repository.split("/");
const { commits, accessible } = await getCommitsBetween(owner!, repo!, from, to, process.env.GITHUB_TOKEN);
if (!accessible) throw new Error("Cannot read full replay range; no tickets updated");
const prefixes = (process.env.LINEAR_TICKET_PREFIXES || "HQ").split(",").map((value) => value.trim()).filter(Boolean);
const tickets = [...new Set(commits.flatMap((commit) => extractTicketsFromCommit(commit.message, prefixes)))];
console.log(`[REPLAY] ${commits.length} commits, ${tickets.length} unique tickets; checkpoint unchanged`);
const success = await processLinearTickets(tickets, apiKey, Bun.argv.includes("--dry-run"));
if (!success) process.exitCode = 1;
