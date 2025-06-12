import {
  getArgoApplication,
  getCurrentRevision,
  getPreviousRevision,
} from "./helpers/argo";
import { loadConfig } from "./config";
import { getChartLockDiff, getAllAppCommits } from "./helpers/github";
import { extractLinearTickets, processLinearTickets } from "./helpers/linear";

const isDryRun = true;

async function main() {
  const config = loadConfig();

  const argoApp = await getArgoApplication(
    config.argoCdUrl,
    config.argoCdUser,
    config.argoCdPassword,
    config.argoCdAppName
  );

  if (!argoApp) {
    console.error("❌ Failed to get ArgoCD application");
    process.exit(1);
  }

  const currentRevision = getCurrentRevision(argoApp);
  const previousRevision = getPreviousRevision(argoApp);

  console.log(
    `🚀 ${argoApp.metadata.name} | ${
      argoApp.status.sync.status
    } | ${currentRevision.substring(0, 8)}...${previousRevision.substring(
      0,
      8
    )}`
  );

  if (
    currentRevision &&
    previousRevision &&
    currentRevision !== previousRevision
  ) {
    try {
      console.log("🔍 Getting Chart.lock diff from GitHub...");
      const appChanges = await getChartLockDiff(
        currentRevision,
        previousRevision,
        config.githubToken
      );

      if (appChanges.length > 0) {
        console.log(
          `📊 ${appChanges.length} apps changed: ${appChanges
            .map((app) => app.appName)
            .join(", ")}`
        );

        const { commits: appCommits, inaccessible } = await getAllAppCommits(
          appChanges,
          config.githubToken
        );
        const totalCommits = Object.values(appCommits).reduce(
          (sum, commits) => sum + commits.length,
          0
        );
        console.log(`📝 ${totalCommits} commits found`);

        if (inaccessible.length > 0) {
          console.log(
            `⚠️ ${
              inaccessible.length
            } repos not found or commits not accessible: ${inaccessible.join(
              ", "
            )}`
          );
        }

        const linearTickets = extractLinearTickets(appCommits);
        if (linearTickets.length > 0) {
          console.log(
            `🎫 ${linearTickets.length} tickets: ${linearTickets.join(", ")}`
          );

          await processLinearTickets(
            linearTickets,
            config.linearApiKey,
            isDryRun
          );
        } else {
          console.log("🎫 No tickets found");
        }
      } else {
        console.log("📊 No changes");
      }
    } catch (error) {
      console.error("❌ Error:", error);
    }
  } else {
    console.log("⚠️ No revision changes");
  }
}

main();
