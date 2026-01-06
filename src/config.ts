import type { Config } from "../types/config";

export const loadConfig = () => {
  const renderBranchEnv = process.env.RENDER_BRANCH;
  const renderBranch =
    renderBranchEnv === "" ? undefined : renderBranchEnv || "main";

  const linearTicketPrefixesEnv = process.env.LINEAR_TICKET_PREFIXES;
  const linearTicketPrefixes = linearTicketPrefixesEnv
    ? linearTicketPrefixesEnv
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  const config: Config = {
    linearApiKey: process.env.LINEAR_API_KEY || "",
    renderApiKey: process.env.RENDER_API_KEY || "",
    renderWorkspaceId: process.env.RENDER_WORKSPACE_ID,
    renderBranch,
    webhookSecret: process.env.WEBHOOK_SECRET,
    linearTicketPrefixes,
    dryRun: process.env.DRY_RUN === "true",
    dbPath: process.env.DB_PATH || "./render-linear-sync.db",
  };

  validateConfig(config);

  return config;
};

export const validateConfig = (config: Config) => {
  const requiredVars = {
    LINEAR_API_KEY: config.linearApiKey,
    RENDER_API_KEY: config.renderApiKey,
    LINEAR_TICKET_PREFIXES: config.linearTicketPrefixes.length > 0,
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error("\n💡 Please check your .env file or environment variables");
    process.exit(1);
  }

  if (config.linearTicketPrefixes.length === 0) {
    console.error("❌ LINEAR_TICKET_PREFIXES must contain at least one prefix");
    process.exit(1);
  }

  if (!config.linearApiKey.startsWith("lin_api_")) {
    console.warn(
      'LINEAR_API_KEY might be invalid - should start with "lin_api_"'
    );
  }
};
