import { afterEach, describe, expect, mock, test } from "bun:test";
import { getCommitsBetween } from "./github";
import { getLinearIssue, moveIssueToDone, processLinearTickets } from "./linear";
import { initDatabase, closeDatabase, getLastProcessedCommit, setLastProcessedCommit } from "./database";
import { processDeployWebhook } from "./webhook";

const originalFetch = globalThis.fetch;
const from = "a".repeat(40), to = "b".repeat(40);
const issue = { id: "issue-1", identifier: "HQ-123", title: "Fix", team: { id: "hq-team" }, state: { id: "merged", name: "PR merged", type: "started" } };
const commit = (n: number) => ({ sha: String(n).padStart(40, "0"), commit: { message: `fix HQ-${n}` }, author: null });
const json = (data: unknown) => Response.json(data);
function useFetch(handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = Object.assign(mock(handler), { preconnect: originalFetch.preconnect });
}
afterEach(() => { globalThis.fetch = originalFetch; closeDatabase(); });

describe("GitHub recovery ranges", () => {
  test("reads all 350 commits over four pages", async () => {
    const pages: number[] = [];
    useFetch(async (url) => {
      const page = Number(new URL(String(url)).searchParams.get("page"));
      pages.push(page);
      const count = page === 4 ? 50 : 100;
      return json({ status: "ahead", total_commits: 350, commits: Array.from({ length: count }, (_, n) => commit((page - 1) * 100 + n)) });
    });
    const result = await getCommitsBetween("noona-hq", "api", from, to);
    expect(result.commits).toHaveLength(350);
    expect(result.accessible).toBe(true);
    expect(pages).toEqual([1, 2, 3, 4]);
  });
  test("discards partial results when a later page fails", async () => {
    useFetch(async (url) => new URL(String(url)).searchParams.get("page") === "1"
      ? json({ status: "ahead", total_commits: 101, commits: Array.from({ length: 100 }, (_, n) => commit(n)) })
      : new Response(null, { status: 403 }));
    expect(await getCommitsBetween("noona-hq", "api", from, to)).toEqual({ commits: [], accessible: false });
  });
  test("rejects rollback/diverged ranges", async () => {
    useFetch(async () => json({ status: "behind", total_commits: 0, commits: [] }));
    expect((await getCommitsBetween("noona-hq", "api", from, to)).accessible).toBe(false);
  });
});

describe("Linear recovery", () => {
  test("selects Done from the issue's own team", async () => {
    const variables: Record<string, string>[] = [];
    useFetch(async (_url, init) => {
      const request = JSON.parse(String(init?.body)); variables.push(request.variables);
      if (request.query.includes("GetIssue")) return json({ data: { issue } });
      if (request.query.includes("GetStates")) return json({ data: { team: { states: { nodes: [{ id: "hq-done", name: "Done", type: "completed" }] } } } });
      return json({ data: { issueUpdate: { success: true } } });
    });
    expect(await moveIssueToDone("test-key", "HQ-123")).toBe(true);
    expect(variables).toEqual([{ id: "HQ-123" }, { id: "hq-team" }, { id: "issue-1", stateId: "hq-done" }]);
  });
  test("reports GraphQL permission errors even on HTTP 200", async () => {
    useFetch(async () => json({ errors: [{ message: "Permission denied" }] }));
    expect(getLinearIssue("test-key", "HQ-123")).rejects.toThrow("Permission denied");
  });
  test("redacts the API key if an error echoes it", async () => {
    useFetch(async () => json({ errors: [{ message: "Invalid test-key" }] }));
    expect(getLinearIssue("test-key", "HQ-123")).rejects.toThrow("[redacted]");
  });
  test("dry run never mutates and canceled/duplicate issues stay untouched", async () => {
    for (const type of ["started", "completed", "canceled", "duplicate"]) {
      const requests: string[] = [];
      useFetch(async (_url, init) => {
        const query = JSON.parse(String(init?.body)).query; requests.push(query);
        return json({ data: { issue: { ...issue, state: { ...issue.state, type } } } });
      });
      expect(await processLinearTickets(["HQ-123"], "test-key", type === "started")).toBe(true);
      expect(requests).toHaveLength(1);
    }
  });
});

describe("checkpoint recovery", () => {
  async function run({ dryRun = false, failMutation = false, failCompare = false, noTickets = false } = {}) {
    initDatabase(":memory:");
    setLastProcessedCommit("srv", "api", "main", from);
    useFetch(async (url, init) => {
      const path = String(url);
      if (path.endsWith("/services/srv")) return json({ id: "srv", name: "api", repo: "https://github.com/noona-hq/api", branch: "main" });
      if (path.endsWith("/events/evt")) return json({ details: { deployId: "dep" } });
      if (path.endsWith("/deploys/dep")) return json({ id: "dep", status: "live", commit: { id: to, message: "Release" } });
      if (path.includes("/compare/")) return failCompare ? new Response(null, { status: 503 }) : json({ status: "ahead", total_commits: 1, commits: [{ ...commit(123), commit: { message: noTickets ? "chore" : "fix HQ-123" } }] });
      const request = JSON.parse(String(init?.body));
      if (request.query.includes("GetIssue")) return json({ data: { issue } });
      if (request.query.includes("GetStates")) return json({ data: { team: { states: { nodes: [{ id: "hq-done", name: "Done", type: "completed" }] } } } });
      return failMutation ? json({ errors: [{ message: "Permission denied" }] }) : json({ data: { issueUpdate: { success: true } } });
    });
    return processDeployWebhook({ timestamp: new Date().toISOString(), type: "deploy_ended", data: { id: "evt", serviceId: "srv", serviceName: "api", status: "succeeded" } }, "render-key", "test-key", dryRun, "main", ["HQ"]);
  }
  test("advances only after successful updates", async () => { await run(); expect(getLastProcessedCommit("srv", "main")).toBe(to); });
  test("retains the baseline on Linear errors", async () => { await expect(run({ failMutation: true })).rejects.toThrow("checkpoint unchanged"); expect(getLastProcessedCommit("srv", "main")).toBe(from); });
  test("retains the baseline on incomplete GitHub reads", async () => { await expect(run({ failCompare: true })).rejects.toThrow("checkpoint unchanged"); expect(getLastProcessedCommit("srv", "main")).toBe(from); });
  test("dry run retains the baseline with and without tickets", async () => {
    await run({ dryRun: true }); expect(getLastProcessedCommit("srv", "main")).toBe(from);
    closeDatabase();
    await run({ dryRun: true, noTickets: true }); expect(getLastProcessedCommit("srv", "main")).toBe(from);
  });
});
