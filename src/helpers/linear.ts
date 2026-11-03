import { saveProcessedTicket, wasTicketProcessedForDeploy } from "./database";
import type { DeployTicketInfo } from "../../types/linear";

const LINEAR_API_URL = "https://api.linear.app/graphql";

export function extractTicketsFromCommit(message: string, prefixes: string[]): string[] {
  const matches = message.match(new RegExp(`(${prefixes.join("|")})-\\d+`, "gi")) || [];
  return [...new Set(matches.map((ticket) => ticket.toUpperCase()))];
}

async function linearRequest<T>(apiKey: string, query: string, variables: Record<string, string>): Promise<T> {
  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Linear HTTP ${response.status}`);
  const result = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (result.errors?.length) {
    // Include GraphQL's reason, but never log credentials or request headers.
    const message = result.errors.map((error) => error.message).join("; ");
    throw new Error(`Linear: ${message.split(apiKey).join("[redacted]")}`);
  }
  if (!result.data) throw new Error("Linear returned no data");
  return result.data;
}

export async function getLinearIssue(apiKey: string, identifier: string): Promise<LinearIssue | null> {
  const data = await linearRequest<{ issue: LinearIssue | null }>(apiKey, `
    query GetIssue($id: String!) {
      issue(id: $id) {
        id identifier title
        team { id }
        state { id name type }
      }
    }`, { id: identifier });
  return data.issue;
}

export async function getDoneState(apiKey: string, teamId: string): Promise<LinearState | null> {
  const data = await linearRequest<{ team: { states: { nodes: LinearState[] } } | null }>(apiKey, `
    query GetStates($id: String!) {
      team(id: $id) { states { nodes { id name type } } }
    }`, { id: teamId });
  return data.team?.states.nodes.find((state) => state.name.trim().toLowerCase() === "done") || null;
}

export async function updateIssueState(apiKey: string, issueId: string, stateId: string): Promise<boolean> {
  const data = await linearRequest<{ issueUpdate: { success: boolean } }>(apiKey, `
    mutation UpdateIssue($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) { success }
    }`, { id: issueId, stateId });
  if (!data.issueUpdate.success) throw new Error("Linear issueUpdate returned success=false");
  return true;
}

export async function moveIssueToDone(apiKey: string, identifier: string, knownIssue?: LinearIssue): Promise<boolean> {
  const issue = knownIssue || await getLinearIssue(apiKey, identifier);
  if (!issue) throw new Error(`Issue ${identifier} not found`);
  const state = await getDoneState(apiKey, issue.team.id);
  if (!state) throw new Error(`No Done state in team ${issue.team.id}`);
  return issue.state.id === state.id || await updateIssueState(apiKey, issue.id, state.id);
}

export async function processLinearTickets(
  tickets: string[], apiKey: string, isDryRun = false, deployTickets: DeployTicketInfo[] = []
): Promise<boolean> {
  let alreadyDone = 0, movedToDone = 0, errors = 0;
  console.log(`[INFO] Checking ${tickets.length} Linear tickets...`);
  // Bound request volume when recovering a long backlog; continue collecting errors.
  for (const ticketId of [...new Set(tickets)]) {
    try {
      const issue = await getLinearIssue(apiKey, ticketId);
      if (!issue) throw new Error("Issue not found");
      if (["completed", "canceled", "duplicate"].includes(issue.state.type)) {
        alreadyDone++;
        continue;
      }
      if (isDryRun) {
        console.log(`[DRY-RUN] Would move ${ticketId} from ${issue.state.name} to Done`);
        continue;
      }
      await moveIssueToDone(apiKey, ticketId, issue);
      const deploy = deployTickets.find((item) => item.tickets.includes(ticketId));
      if (deploy && !wasTicketProcessedForDeploy(ticketId, deploy.deployId)) {
        saveProcessedTicket(ticketId, issue.title, issue.state.name, "Done", deploy.deployId,
          deploy.serviceId, deploy.serviceName, deploy.commitId, deploy.commitMessage);
      }
      movedToDone++;
      console.log(`[SUCCESS] Issue ${ticketId} moved to Done`);
    } catch (error) {
      errors++;
      console.error(`[ERROR] ${ticketId}: ${error instanceof Error ? error.message : "Linear request failed"}`);
    }
  }
  console.log(`[INFO] ${alreadyDone} already terminal; ${movedToDone} moved to Done; ${errors} errors`);
  return errors === 0;
}
