import { loadConfig } from "./config";
import { initDatabase, closeDatabase } from "./helpers/database";
import { processDeployWebhook } from "./helpers/webhook";
import type { RenderWebhookPayload } from "../types/webhook";

const main = async () => {
  const config = loadConfig();

  initDatabase(config.dbPath);

  const isDryRun = config.dryRun;

  if (isDryRun) {
    console.log("🧪 DRY RUN MODE - No changes will be made to Linear tickets");
  }

  console.log("🚀 Starting Render-Linear Sync Webhook Receiver...");
  console.log(`📡 Listening on port ${process.env.PORT || 3000}`);
  console.log(
    `🔗 Webhook URL: http://localhost:${process.env.PORT || 3000}/webhook`
  );
  console.log(
    "\n💡 Configure this URL in Render Dashboard → Integrations → Webhooks"
  );
  console.log("   Event: deploy.ended\n");

  Bun.serve({
    port: parseInt(process.env.PORT || "3000", 10),
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/health" || url.pathname === "/") {
        return new Response(
          JSON.stringify({
            status: "ok",
            service: "render-linear-sync",
            mode: isDryRun ? "dry-run" : "live",
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (url.pathname === "/webhook" && req.method === "POST") {
        try {
          const payload = (await req.json()) as RenderWebhookPayload;

          if (payload.type !== "deploy_ended") {
            return new Response(
              JSON.stringify({ message: "Event type not supported" }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          processDeployWebhook(
            payload,
            config.renderApiKey,
            config.linearApiKey,
            isDryRun,
            config.renderBranch
          ).catch((error) => {
            console.error("❌ Error processing webhook:", error);
          });

          return new Response(
            JSON.stringify({ message: "Webhook received and processing" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("❌ Error parsing webhook payload:", error);
          return new Response(JSON.stringify({ error: "Invalid payload" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.log("✨ Webhook server is running. Press Ctrl+C to stop.\n");

  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down gracefully...");
    closeDatabase();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n🛑 Shutting down gracefully...");
    closeDatabase();
    process.exit(0);
  });
};

main();
