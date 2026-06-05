import { listDeploys, getService, getEvent, getDeploy } from "./render";
import { extractTicketsFromCommit, processLinearTickets } from "./linear";
import { getLastProcessedCommit, setLastProcessedCommit } from "./database";
import { getCommit, getCommitsBetween, parseGitHubRepo } from "./github";
import { parseImageCommitRef } from "./image";
import type { DeployTicketInfo } from "../../types/linear";
import type { RenderDeploy } from "../../types/render";
import type { RenderWebhookPayload } from "../../types/webhook";

const parseAllowedBranches = (
  branchFilter: string | undefined
): string[] | undefined => {
  if (branchFilter === undefined) {
    return undefined;
  }

  const branches = branchFilter
    .split(",")
    .map((branch) => branch.trim())
    .filter(Boolean);

  return branches.length > 0 ? branches : undefined;
};

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

  console.log(
    `\n[INFO] Processing deploy webhook: ${serviceName} (${payload.data.id})`
  );

  const event = await getEvent(renderApiKey, payload.data.id);
  const eventDeployId = event?.details?.deployId;

  let matchingDeploy: RenderDeploy | null = null;
  if (eventDeployId) {
    matchingDeploy = await getDeploy(renderApiKey, serviceId, eventDeployId);
  }

  if (!matchingDeploy) {
    const deploys = await listDeploys(renderApiKey, serviceId, 5);
    matchingDeploy =
      deploys.find((deploy) => deploy.status === "live") || null;
  }

  if (!matchingDeploy) {
    console.log(`[WARN] No matching deploy found for service ${serviceName}`);
    return;
  }

  const allowedBranches = parseAllowedBranches(branch);
  const gitRepo = service.repo ? parseGitHubRepo(service.repo) : null;
  const imageCommitRef = parseImageCommitRef(matchingDeploy.image?.ref);
  const sourceRepo = gitRepo || imageCommitRef;

  let serviceBranch = service.branch || null;
  if (!serviceBranch && imageCommitRef && allowedBranches?.length === 1) {
    serviceBranch = allowedBranches[0] || null;
  }

  if (allowedBranches && serviceBranch && !allowedBranches.includes(serviceBranch)) {
    console.log(
      `[SKIP] Skipping deploy ${payload.data.id} - service ${serviceName} branch "${serviceBranch}" doesn't match "${allowedBranches.join(", ")}"`
    );
    return;
  }

  if (allowedBranches && !serviceBranch) {
    console.log(
      `[SKIP] Skipping deploy ${payload.data.id} - service ${serviceName} has no branch information`
    );
    return;
  }

  let currentCommitId = matchingDeploy.commit?.id || imageCommitRef?.commitId || null;
  let currentCommitMessage = matchingDeploy.commit?.message || null;

  if (!currentCommitMessage && imageCommitRef) {
    const commit = await getCommit(
      imageCommitRef.owner,
      imageCommitRef.repo,
      imageCommitRef.commitId,
      githubToken
    );
    currentCommitMessage = commit?.message || null;
  }

  if (!currentCommitId) {
    console.log(`[WARN] No commit ID found for deploy ${matchingDeploy.id}`);
    return;
  }

  const lastProcessedCommitId = getLastProcessedCommit(
    serviceId,
    serviceBranch || "unknown"
  );

  let allTickets: string[] = [];
  let commitsToProcess: Array<{ id: string; message: string }> = [];

  if (lastProcessedCommitId && sourceRepo) {
    console.log(
      `[INFO] Fetching commits between ${lastProcessedCommitId.substring(
        0,
        7
      )} and ${currentCommitId.substring(0, 7)}`
    );

    const { commits, accessible } = await getCommitsBetween(
      sourceRepo.owner,
      sourceRepo.repo,
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
  }

  if (commitsToProcess.length === 0 && currentCommitMessage) {
    const currentCommitTickets = extractTicketsFromCommit(
      currentCommitMessage,
      ticketPrefixes
    );
    if (currentCommitTickets.length > 0) {
      allTickets.push(...currentCommitTickets);
      commitsToProcess.push({
        id: currentCommitId,
        message: currentCommitMessage,
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
      serviceBranch || "unknown",
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
          : commitsToProcess[0]?.message || currentCommitMessage || "",
      tickets: allTickets,
    },
  ];

  await processLinearTickets(allTickets, linearApiKey, isDryRun, deployTickets);

  setLastProcessedCommit(
    serviceId,
    serviceName,
    serviceBranch || "unknown",
    currentCommitId
  );
};
