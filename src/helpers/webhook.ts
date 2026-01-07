import { listDeploys, getService } from "./render";
import { extractTicketsFromCommit, processLinearTickets } from "./linear";
import { getLastProcessedCommit, setLastProcessedCommit } from "./database";
import { parseGitHubRepo, getCommitsBetween } from "./github";
import type { DeployTicketInfo } from "../../types/linear";
import type { RenderWebhookPayload } from "../../types/webhook";

export const processDeployWebhook = async (
  payload: RenderWebhookPayload,
  renderApiKey: string,
  linearApiKey: string,
  isDryRun: boolean,
  branch: string | undefined,
  ticketPrefixes: string[],
  githubToken?: string
) => {
  if (payload.data.status !== "succeeded") {
    console.log(
      `[SKIP] Skipping deploy ${payload.data.id} - status: ${payload.data.status}`
    );
    return;
  }

  const serviceId = payload.data.serviceId;
  const serviceName = payload.data.serviceName;

  const service = await getService(renderApiKey, serviceId);
  if (!service) {
    console.log(`[WARN] Could not fetch service ${serviceId}`);
    return;
  }

  const serviceBranch = service.branch;
  if (!serviceBranch) {
    console.log(`[WARN] Service ${serviceName} has no branch information`);
    return;
  }

  if (branch && serviceBranch !== branch) {
    console.log(
      `[SKIP] Skipping deploy ${payload.data.id} - service ${serviceName} branch "${serviceBranch}" doesn't match "${branch}"`
    );
    return;
  }

  console.log(
    `\n[INFO] Processing deploy webhook: ${serviceName} (${payload.data.id})`
  );

  const deploys = await listDeploys(renderApiKey, serviceId, 5);
  const matchingDeploy =
    deploys.find((deploy) => deploy.status === "live") || null;

  if (!matchingDeploy) {
    console.log(`[WARN] No matching deploy found for service ${serviceName}`);
    return;
  }

  if (!matchingDeploy.commit?.id) {
    console.log(`[WARN] No commit ID found for deploy ${matchingDeploy.id}`);
    return;
  }

  const currentCommitId = matchingDeploy.commit.id;
  const lastProcessedCommitId = getLastProcessedCommit(
    serviceId,
    serviceBranch
  );

  let allTickets: string[] = [];
  let commitsToProcess: Array<{ id: string; message: string }> = [];

  if (lastProcessedCommitId && service.repo) {
    const repoInfo = parseGitHubRepo(service.repo);
    if (repoInfo) {
      console.log(
        `[INFO] Fetching commits between ${lastProcessedCommitId.substring(
          0,
          7
        )} and ${currentCommitId.substring(0, 7)}`
      );

      const { commits, accessible } = await getCommitsBetween(
        repoInfo.owner,
        repoInfo.repo,
        lastProcessedCommitId,
        currentCommitId,
        githubToken
      );

      if (accessible && commits.length > 0) {
        console.log(`[INFO] Found ${commits.length} commit(s) in range`);

        for (const commit of commits) {
          const commitTickets = extractTicketsFromCommit(
            commit.message,
            ticketPrefixes
          );
          if (commitTickets.length > 0) {
            allTickets.push(...commitTickets);
            commitsToProcess.push({
              id: commit.sha,
              message: commit.message,
            });
          }
        }
      } else if (!accessible) {
        console.log(
          `[WARN] Could not access GitHub commits, falling back to current commit only`
        );
      }
    } else {
      console.log(
        `[WARN] Repository URL "${service.repo}" is not a GitHub repository`
      );
    }
  }

  if (commitsToProcess.length === 0 && matchingDeploy.commit?.message) {
    const currentCommitTickets = extractTicketsFromCommit(
      matchingDeploy.commit.message,
      ticketPrefixes
    );
    if (currentCommitTickets.length > 0) {
      allTickets.push(...currentCommitTickets);
      commitsToProcess.push({
        id: currentCommitId,
        message: matchingDeploy.commit.message,
      });
    }
  }

  allTickets = [...new Set(allTickets)];

  if (allTickets.length === 0) {
    console.log(
      `[INFO] No tickets found in ${
        commitsToProcess.length > 0 ? "commits" : "commit"
      }`
    );
    setLastProcessedCommit(
      serviceId,
      serviceName,
      serviceBranch,
      currentCommitId
    );
    return;
  }

  console.log(
    `[INFO] Found ${allTickets.length} ticket(s): ${allTickets.join(", ")} in ${
      commitsToProcess.length
    } commit(s)`
  );

  const deployTickets: DeployTicketInfo[] = [
    {
      deployId: matchingDeploy.id,
      serviceId: serviceId,
      serviceName: serviceName,
      commitId: currentCommitId,
      commitMessage:
        commitsToProcess.length > 1
          ? `Range: ${commitsToProcess.length} commits`
          : commitsToProcess[0]?.message || matchingDeploy.commit.message || "",
      tickets: allTickets,
    },
  ];

  await processLinearTickets(allTickets, linearApiKey, isDryRun, deployTickets);

  setLastProcessedCommit(
    serviceId,
    serviceName,
    serviceBranch,
    currentCommitId
  );
};
