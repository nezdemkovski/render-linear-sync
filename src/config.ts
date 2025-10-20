export interface Config {
  linearApiKey: string;
  githubToken: string;
  argoCdUrl: string;
  argoCdUser: string;
  argoCdPassword: string;
  argoCdAppName: string;
  dryRun: boolean;
}

export function loadConfig(): Config {
  const requiredVars = {
    LINEAR_API_KEY: process.env.LINEAR_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    ARGOCD_URL: process.env.ARGOCD_URL,
    ARGOCD_USER: process.env.ARGOCD_USER,
    ARGOCD_PASSWORD: process.env.ARGOCD_PASSWORD,
    ARGOCD_APP_NAME: process.env.ARGOCD_APP_NAME,
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
    githubToken: process.env.GITHUB_TOKEN!,
    argoCdUrl: process.env.ARGOCD_URL!,
    argoCdUser: process.env.ARGOCD_USER!,
    argoCdPassword: process.env.ARGOCD_PASSWORD!,
    argoCdAppName: process.env.ARGOCD_APP_NAME!,
    dryRun: process.env.DRY_RUN === "true",
  };

  return config;
}

export function validateConfig(config: Config): void {
  if (!config.linearApiKey.startsWith("lin_api_")) {
    console.warn(
      'LINEAR_API_KEY might be invalid - should start with "lin_api_"'
    );
  }
}
