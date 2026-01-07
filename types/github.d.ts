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
    author: {
      login: string;
      avatar_url: string;
    } | null;
    html_url: string;
  }

  interface GitHubCommitsResponse {
    commits: GitHubCommit[];
  }
}

export {};
