import {
  getArgoApplication,
  getCurrentRevision,
  getPreviousRevision,
} from "./helpers/argo";
import { loadConfig } from "./config";
import { getChartLockDiff, getAllAppCommits } from "./helpers/github";
import { extractLinearTickets, processLinearTickets } from "./helpers/linear";

async function main() {
  const config = loadConfig();

  if (config.dryRun) {
    console.log("🧪 DRY RUN MODE - No changes will be made to Linear tickets");
  }

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

        // Print commits per app in a pretty format
        for (const [appName, commits] of Object.entries(appCommits)) {
          if (!Array.isArray(commits) || commits.length === 0) continue;
          console.log(`\n📦 ${appName}:`);
          for (const commit of commits) {
            // Highlight ticket IDs (e.g., HQ-1234) with cyan background and white text
            const prettyCommit = commit.replace(
              /([A-Z]+-\d+)/g,
              "\x1b[46m\x1b[97m$1\x1b[0m"
            );
            console.log(`  • ${prettyCommit}`);
          }
        }

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
            config.dryRun
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
