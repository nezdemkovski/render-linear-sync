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

    const response = await fetch(compareUrl, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return { commits: [], accessible: false };
      }
      if (response.status === 403 && !githubToken) {
        console.log(
          `[WARN] GitHub API rate limit reached. Consider setting GITHUB_TOKEN for higher limits`
        );
        return { commits: [], accessible: false };
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const compareData = (await response.json()) as GitHubCommitsResponse;

    const commits = compareData.commits
      .map((commit) => {
        const title = commit.commit.message.split("\n")[0];
        const message = title || commit.commit.message;
        const author = commit.author?.login || null;
        return { sha: commit.sha, message, author };
      })
      .filter((commit) => commit.message.length > 0);

    return { commits, accessible: true };
  } catch (error) {
    return { commits: [], accessible: false };
  }
};
