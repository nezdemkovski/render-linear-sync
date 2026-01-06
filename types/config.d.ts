export interface Config {
  linearApiKey: string;
  renderApiKey: string;
  renderWorkspaceId: string | undefined;
  renderBranch: string;
  dryRun: boolean;
  dbPath: string;
}
