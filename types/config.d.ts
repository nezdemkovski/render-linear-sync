export interface Config {
  linearApiKey: string;
  renderApiKey: string;
  renderWorkspaceId: string | undefined;
  renderBranch: string | undefined;
  webhookSecret: string | undefined;
  dryRun: boolean;
  dbPath: string;
}
