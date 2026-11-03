const GITHUB_API_BASE = "https://api.github.com";

export interface CommitWithAuthor {
  sha: string;
  message: string;
  author: string | null;
}

export const parseGitHubRepo = (repoUrl: string) => {
  const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w.-]+?)(?:\.git)?$/);

  if (match && match[1] && match[2]) {
    return {
      owner: match[1],
      repo: match[2],
    };
  }

  return null;
};

export const getCommitsBetween = async (
  owner: string,
  repo: string,
  previousSha: string,
  currentSha: string,
  githubToken?: string
) => {
  try {
    const compareUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/compare/${previousSha}...${currentSha}`;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "render-linear-sync",
    };

    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    const commits: CommitWithAuthor[] = [];
    let expectedTotal = 0;
    for (let page = 1; ; page++) {
      const response = await fetch(`${compareUrl}?per_page=100&page=${page}`, { headers });
      if (!response.ok) throw new Error(`GitHub compare HTTP ${response.status} on page ${page}`);
      const data = (await response.json()) as GitHubCommitsResponse;
      if (data.status !== "ahead" && data.status !== "identical") {
        throw new Error(`Refusing a ${data.status} commit range`);
      }
      expectedTotal = data.total_commits;
      for (const commit of data.commits) {
        commits.push({ sha: commit.sha, message: commit.commit.message.split("\n")[0] || commit.commit.message, author: commit.author?.login || null });
      }
      if (commits.length >= expectedTotal) break;
      if (data.commits.length === 0) throw new Error("GitHub returned an incomplete commit range");
    }
    if (commits.length !== expectedTotal) throw new Error("GitHub commit count does not match total_commits");
    return { commits, accessible: true };
  } catch (error) {
    console.error(`[ERROR] ${error instanceof Error ? error.message : "GitHub compare failed"}`);
    return { commits: [], accessible: false };
  }
};

export const getCommit = async (
  owner: string,
  repo: string,
  sha: string,
  githubToken?: string
) => {
  try {
    const commitUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${sha}`;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "render-linear-sync",
    };

    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    const response = await fetch(commitUrl, { headers });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const commit = (await response.json()) as GitHubCommit;
    const title = commit.commit.message.split("\n")[0];

    return {
      sha: commit.sha,
      message: title || commit.commit.message,
      author: commit.author?.login || null,
    };
  } catch (error) {
    return null;
  }
};
