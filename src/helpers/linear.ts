import { saveProcessedTicket, wasTicketProcessedForDeploy } from "./database";
import type { DeployTicketInfo } from "../../types/linear";

const LINEAR_API_URL = "https://api.linear.app/graphql";

function createTicketRegex(prefixes: string[]): RegExp {
  const prefixPattern = prefixes.join("|");
  return new RegExp(`(${prefixPattern})-\\d+`, "gi");
}

export function extractTicketsFromCommit(
  commitMessage: string,
  prefixes: string[]
): string[] {
  const ticketRegex = createTicketRegex(prefixes);
  const matches = commitMessage.match(ticketRegex);

  if (!matches) {
    return [];
  }

  return [...new Set(matches.map((ticket) => ticket.toUpperCase()))];
}

export const getLinearIssue = async (
  apiKey: string,
  issueIdentifier: string
) => {
  const query = `
    query GetIssue($id: String!) {
      issue(id: $id) {
        id
        identifier
        title
        state {
          id
          name
        }
      }
    }
  `;

  try {
    const response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { id: issueIdentifier },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to get Linear issue ${issueIdentifier}: ${response.status} ${response.statusText}`
      );
      console.error(`Response: ${errorText}`);
      return null;
    }

    const data = (await response.json()) as { data: { issue: LinearIssue } };
    return data.data.issue;
  } catch (error) {
    console.error("Error getting Linear issue:", error);
    return null;
  }
};

export const getDoneState = async (apiKey: string) => {
  const query = `
    query GetStates {
      workflowStates {
        nodes {
          id
          name
          type
        }
      }
    }
  `;

  try {
    const response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error(
        `Failed to get Linear states: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = (await response.json()) as {
      data: {
        workflowStates: {
          nodes: LinearState[];
        };
      };
    };

    const doneState = data.data.workflowStates.nodes.find(
      (state) => state.name.trim().toLowerCase() === "done"
    );

    return doneState || null;
  } catch (error) {
    console.error("Error getting Linear states:", error);
    return null;
  }
};

export const updateIssueState = async (
  apiKey: string,
  issueId: string,
  stateId: string
) => {
  const mutation = `
    mutation UpdateIssue($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) {
        success
        issue {
          id
          identifier
          state {
            name
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          id: issueId,
          stateId,
        },
      }),
    });

    if (!response.ok) {
      console.error(
        `Failed to update Linear issue: ${response.status} ${response.statusText}`
      );
      return false;
    }

    const data = (await response.json()) as {
      data: {
        issueUpdate: {
          success: boolean;
          issue: LinearIssue;
        };
      };
    };

    if (data.data.issueUpdate.success) {
      console.log(
        `✅ Issue ${data.data.issueUpdate.issue.identifier} moved to ${data.data.issueUpdate.issue.state.name}`
      );
      return true;
    } else {
      console.error("Failed to update issue state");
      return false;
    }
  } catch (error) {
    console.error("Error updating Linear issue:", error);
    return false;
  }
};

export const moveIssueToDone = async (apiKey: string, issueId: string) => {
  const doneState = await getDoneState(apiKey);
  if (!doneState) {
    console.error('Could not find "Done" state in Linear');
    return false;
  }

  const issue = await getLinearIssue(apiKey, issueId);
  if (!issue) {
    console.error(`Issue ${issueId} not found in Linear`);
    return false;
  }

  if (issue.state.id === doneState.id) {
    console.log(
      `✅ Issue ${issue.identifier} is already in ${issue.state.name} state`
    );
    return true;
  }

  return await updateIssueState(apiKey, issue.id, doneState.id);
};

export const processLinearTickets = async (
  tickets: string[],
  apiKey: string,
  isDryRun: boolean = false,
  deployTickets: DeployTicketInfo[] = []
) => {
  if (tickets.length === 0) {
    return;
  }

  console.log(`\n🔍 Checking ${tickets.length} Linear tickets...`);

  const ticketPromises = tickets.map(async (ticketId) => {
    try {
      const issue = await getLinearIssue(apiKey, ticketId);
      return { ticketId, issue, error: null };
    } catch (error) {
      return { ticketId, issue: null, error };
    }
  });

  const ticketResults = await Promise.all(ticketPromises);

  let alreadyDone = 0;
  let movedToDone = 0;
  let errors = 0;

  const ticketsToMove: string[] = [];

  for (const { ticketId, issue, error } of ticketResults) {
    if (error || !issue) {
      console.error(
        `❌ Failed to fetch ${ticketId}:`,
        error || "Issue not found"
      );
      errors++;
      continue;
    }

    const isDoneState =
      issue.state.name.toLowerCase().includes("done") ||
      issue.state.name.toLowerCase().includes("announced");

    if (isDoneState) {
      alreadyDone++;
    } else {
      if (isDryRun) {
        console.log(
          `🔄 [DRY RUN] Would move ${ticketId} (${issue.title}) to Done (currently: ${issue.state.name})`
        );
        movedToDone++;
      } else {
        ticketsToMove.push(ticketId);
      }
    }
  }

  if (!isDryRun && ticketsToMove.length > 0) {
    const movePromises = ticketsToMove.map(async (ticketId) => {
      try {
        const success = await moveIssueToDone(apiKey, ticketId);
        return { ticketId, success };
      } catch (error) {
        return { ticketId, success: false };
      }
    });

    const moveResults = await Promise.all(movePromises);

    for (const { ticketId, success } of moveResults) {
      if (success) {
        movedToDone++;

        const issue = ticketResults.find((r) => r.ticketId === ticketId)?.issue;
        if (issue) {
          const deployInfo = deployTickets.find((dt) =>
            dt.tickets.includes(ticketId)
          );

          if (deployInfo) {
            if (!wasTicketProcessedForDeploy(ticketId, deployInfo.deployId)) {
              saveProcessedTicket(
                ticketId,
                issue.title,
                issue.state.name,
                "Done",
                deployInfo.deployId,
                deployInfo.serviceId,
                deployInfo.serviceName,
                deployInfo.commitId,
                deployInfo.commitMessage
              );
            }
          }
        }
      } else {
        console.error(
          `❌ Failed to move ${ticketId} to Done - will retry on next run`
        );
        errors++;
      }
    }
  }

  if (alreadyDone > 0) {
    console.log(`✅ ${alreadyDone} tickets are already completed/announced`);
  }

  if (movedToDone > 0) {
    if (isDryRun) {
      console.log(`🔄 ${movedToDone} tickets would be moved to Done (DRY RUN)`);
    } else {
      console.log(`✅ ${movedToDone} tickets moved to Done`);
    }
  }

  if (errors > 0) {
    console.log(
      `❌ ${errors} tickets had errors (will be retried on next run)`
    );
  }
};
