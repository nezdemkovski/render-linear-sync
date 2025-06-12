declare global {
  interface GitHubCommit {
    sha: string;
    commit: {
      message: string;
      author: {
        name: string;
        date: string;
      };
    };
    html_url: string;
  }

  interface GitHubCommitsResponse {
    commits: GitHubCommit[];
  }

  interface GitHubCompareResponse {
    files: Array<{
      filename: string;
      status: string;
      patch?: string;
    }>;
  }

  interface AppVersionChange {
    appName: string;
    current: string;
    previous: string;
  }

  interface ChartLockEntry {
    name: string;
    repository: string;
    version: string;
  }
}

export {};
