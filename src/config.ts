import type { Config } from "../types/config";

export const loadConfig = () => {
  const requiredVars = {
    LINEAR_API_KEY: process.env.LINEAR_API_KEY,
    RENDER_API_KEY: process.env.RENDER_API_KEY,
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

  const config: Config = {
    linearApiKey: process.env.LINEAR_API_KEY!,
    renderApiKey: process.env.RENDER_API_KEY!,
    renderWorkspaceId: process.env.RENDER_WORKSPACE_ID,
    renderBranch: process.env.RENDER_BRANCH || "main",
    webhookSecret: process.env.WEBHOOK_SECRET,
    dryRun: process.env.DRY_RUN === "true",
    dbPath: process.env.DB_PATH || "./render-linear-sync.db",
  };

  validateConfig(config);

  return config;
};

export const validateConfig = (config: Config) => {
  if (!config.linearApiKey.startsWith("lin_api_")) {
    console.warn(
      'LINEAR_API_KEY might be invalid - should start with "lin_api_"'
    );
  }
};
