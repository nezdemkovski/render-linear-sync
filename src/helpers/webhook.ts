import { listDeploys, getService } from "./render";
import { extractTicketsFromCommit, processLinearTickets } from "./linear";
import { wasDeployProcessed } from "./database";
import type { DeployTicketInfo } from "../../types/linear";
import type { RenderWebhookPayload } from "../../types/webhook";

export const processDeployWebhook = async (
  payload: RenderWebhookPayload,
  renderApiKey: string,
  linearApiKey: string,
  isDryRun: boolean,
  branch: string | undefined,
  ticketPrefixes: string[]
) => {
  if (payload.data.status !== "succeeded") {
    console.log(
      `[SKIP] Skipping deploy ${payload.data.id} - status: ${payload.data.status}`
    );
    return;
  }

  const serviceId = payload.data.serviceId;
  const serviceName = payload.data.serviceName;

  if (branch) {
    const service = await getService(renderApiKey, serviceId);
    if (!service) {
      console.log(
        `[WARN] Could not fetch service ${serviceId} to check branch`
      );
      return;
    }

    if (service.branch !== branch) {
      console.log(
        `[SKIP] Skipping deploy ${payload.data.id} - service ${serviceName} branch "${service.branch}" doesn't match "${branch}"`
      );
      return;
    }
  }

  console.log(
    `\n[INFO] Processing deploy webhook: ${serviceName} (${payload.data.id})`
  );

  const deploys = await listDeploys(renderApiKey, serviceId, 5);
  const matchingDeploy =
    deploys.find(
      (deploy) => deploy.status === "live" && !wasDeployProcessed(deploy.id)
    ) || null;

  if (!matchingDeploy) {
    console.log(`[WARN] No matching deploy found for service ${serviceName}`);
    return;
  }

  if (wasDeployProcessed(matchingDeploy.id)) {
    console.log(`[SKIP] Deploy ${matchingDeploy.id} already processed`);
    return;
  }

  if (!matchingDeploy.commit?.message) {
    console.log(
      `[WARN] No commit message found for deploy ${matchingDeploy.id}`
    );
    return;
  }

  const tickets = extractTicketsFromCommit(
    matchingDeploy.commit.message,
    ticketPrefixes
  );

  if (tickets.length === 0) {
    console.log(
      `[INFO] No tickets found in commit: ${matchingDeploy.commit.message.substring(
        0,
        60
      )}...`
    );
    return;
  }

  console.log(
    `[INFO] Found ${tickets.length} ticket(s): ${tickets.join(
      ", "
    )} in commit: ${matchingDeploy.commit.message.substring(0, 60)}...`
  );

  const deployTickets: DeployTicketInfo[] = [
    {
      deployId: matchingDeploy.id,
      serviceId: serviceId,
      serviceName: serviceName,
      commitId: matchingDeploy.commit.id,
      commitMessage: matchingDeploy.commit.message,
      tickets,
    },
  ];

  await processLinearTickets(tickets, linearApiKey, isDryRun, deployTickets);
};
