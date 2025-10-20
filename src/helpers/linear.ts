const LINEAR_API_URL = "https://api.linear.app/graphql";
const TICKET_PREFIXES = ["HQ"];

export function getTicketPrefixes(): string[] {
  return [...TICKET_PREFIXES];
}

function createTicketRegex(prefixes: string[]): RegExp {
  const prefixPattern = prefixes.join("|");
  return new RegExp(`(${prefixPattern})-\\d+`, "gi");
}

export function extractLinearTickets(
  appCommits: Record<string, string[]>
): string[] {
  const tickets = new Set<string>();

  const ticketRegex = createTicketRegex(TICKET_PREFIXES);

  for (const [appName, commits] of Object.entries(appCommits)) {
    for (const commitMessage of commits) {
      const matches = commitMessage.match(ticketRegex);
      if (matches) {
        matches.forEach((ticket) => {
          tickets.add(ticket.toUpperCase());
        });
      }
    }
  }

  return Array.from(tickets).sort();
}

export function extractTicketsFromCommit(commitMessage: string): string[] {
  const ticketRegex = createTicketRegex(TICKET_PREFIXES);
  const matches = commitMessage.match(ticketRegex);

  if (!matches) {
    return [];
  }

  return [...new Set(matches.map((ticket) => ticket.toUpperCase()))];
}

export async function getLinearIssue(
  apiKey: string,
  issueIdentifier: string
): Promise<LinearIssue | null> {
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
}

export async function getDoneState(
  apiKey: string
): Promise<LinearState | null> {
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
}

export async function updateIssueState(
  apiKey: string,
  issueId: string,
  stateId: string
): Promise<boolean> {
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
}

export async function moveIssueToDone(
  apiKey: string,
  issueId: string
): Promise<boolean> {
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
}

export async function processLinearTickets(
  tickets: string[],
  apiKey: string,
  isDryRun: boolean = false
): Promise<void> {
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

    for (const { success } of moveResults) {
      if (success) {
        movedToDone++;
      } else {
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
    console.log(`❌ ${errors} tickets had errors`);
  }
}
