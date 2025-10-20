const GITHUB_API_BASE = "https://api.github.com";
const REPO_OWNER = "noona-hq";
const REPO_NAME = "noona-deployment";

export interface CommitWithAuthor {
  message: string;
  author: string | null;
}

export async function getAppCommits(
  appChange: AppVersionChange,
  githubToken: string
): Promise<{ commits: CommitWithAuthor[]; accessible: boolean }> {
  try {
    const repoName = appChange.appName;

    const compareUrl = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${repoName}/compare/${appChange.previous}...${appChange.current}`;

    const response = await fetch(compareUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "argocd-linear-sync",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
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
        return { message, author };
      })
      .filter((commit) => commit.message.length > 0);

    return { commits, accessible: true };
  } catch (error) {
    return { commits: [], accessible: false };
  }
}

export async function getAllAppCommits(
  appChanges: AppVersionChange[],
  githubToken: string
): Promise<{
  commits: Record<string, CommitWithAuthor[]>;
  inaccessible: string[];
}> {
  const promises = appChanges.map(async (appChange) => {
    const result = await getAppCommits(appChange, githubToken);
    return { appName: appChange.appName, ...result };
  });

  const results = await Promise.all(promises);

  const commits: Record<string, CommitWithAuthor[]> = {};
  const inaccessible: string[] = [];

  results.forEach(({ appName, commits: appCommits, accessible }) => {
    commits[appName] = appCommits;
    if (!accessible) {
      inaccessible.push(appName);
    }
  });

  return { commits, inaccessible };
}

export async function getChartLockDiff(
  currentRevision: string,
  previousRevision: string,
  githubToken: string
): Promise<AppVersionChange[]> {
  try {
    const compareUrl = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/compare/${previousRevision}...${currentRevision}`;

    const response = await fetch(compareUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "argocd-linear-sync",
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      );
    }

    const compareData = (await response.json()) as GitHubCompareResponse;

    const chartLockFile = compareData.files.find(
      (file) => file.filename === "noona/Chart.lock" && file.patch
    );

    if (!chartLockFile || !chartLockFile.patch) {
      return [];
    }

    return parseChartLockDiff(chartLockFile.patch);
  } catch (error) {
    throw error;
  }
}

function parseChartLockDiff(patch: string): AppVersionChange[] {
  const changes: AppVersionChange[] = [];
  const lines = patch.split("\n");

  let currentApp: string | null = null;
  let previousVersion: string | null = null;
  let currentVersion: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line) continue;

    if (line.startsWith("- name: ") || line.startsWith(" - name: ")) {
      if (currentApp && previousVersion && currentVersion) {
        const prevVersionClean = extractVersionHash(previousVersion);
        const currVersionClean = extractVersionHash(currentVersion);

        if (prevVersionClean !== currVersionClean) {
          changes.push({
            appName: currentApp,
            current: currVersionClean,
            previous: prevVersionClean,
          });
        }
      }

      currentApp = line.replace(/^[\s-]*name:\s*/, "").trim();
      previousVersion = null;
      currentVersion = null;
    }

    if (line.startsWith("-  version: ") || line.startsWith("- version: ")) {
      previousVersion = line.replace(/^[\s-]*version:\s*/, "").trim();
    }

    if (line.startsWith("+  version: ") || line.startsWith("+ version: ")) {
      currentVersion = line.replace(/^[\s+]*version:\s*/, "").trim();
    }
  }

  if (currentApp && previousVersion && currentVersion) {
    const prevVersionClean = extractVersionHash(previousVersion);
    const currVersionClean = extractVersionHash(currentVersion);

    if (prevVersionClean !== currVersionClean) {
      changes.push({
        appName: currentApp,
        current: currVersionClean,
        previous: prevVersionClean,
      });
    }
  }

  return changes;
}

function extractVersionHash(version: string): string {
  let withoutSemanticVersion = version.replace(/^\d+\.\d+\.\d+-/, "");

  if (!withoutSemanticVersion || withoutSemanticVersion === version) {
    withoutSemanticVersion = version;
  }

  const withoutVPrefix = withoutSemanticVersion.replace(/^v/, "");

  return withoutVPrefix;
}

export function parseChartLock(content: string): ChartLockEntry[] {
  const entries: ChartLockEntry[] = [];
  const lines = content.split("\n");

  let currentEntry: Partial<ChartLockEntry> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("- name:")) {
      if (
        currentEntry.name &&
        currentEntry.repository &&
        currentEntry.version
      ) {
        entries.push(currentEntry as ChartLockEntry);
      }

      currentEntry = {
        name: trimmed.replace("- name:", "").trim(),
      };
    } else if (trimmed.startsWith("repository:")) {
      currentEntry.repository = trimmed.replace("repository:", "").trim();
    } else if (trimmed.startsWith("version:")) {
      currentEntry.version = trimmed.replace("version:", "").trim();
    }
  }

  if (currentEntry.name && currentEntry.repository && currentEntry.version) {
    entries.push(currentEntry as ChartLockEntry);
  }

  return entries;
}
