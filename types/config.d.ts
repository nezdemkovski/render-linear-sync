export interface Config {
  linearApiKey: string;
  renderApiKey: string;
  renderWorkspaceId: string | undefined;
  renderBranch: string | undefined;
  webhookSecret: string | undefined;
  linearTicketPrefixes: string[];
  dryRun: boolean;
  dbPath: string;
  githubToken: string | undefined;
}
