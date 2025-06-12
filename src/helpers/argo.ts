import { retryWithBackoff } from "./utils";

async function getArgoToken(
  argoUrl: string,
  username: string,
  password: string
): Promise<string> {
  console.log(`🔐 Getting ArgoCD authentication token...`);

  const response = await fetch(`${argoUrl}/api/v1/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  if (!response.ok) {
    let errorBody = "";
    try {
      errorBody = await response.text();
    } catch (e) {}
    throw new Error(
      `ArgoCD login failed: ${response.status} ${response.statusText}. Response: ${errorBody}`
    );
  }

  const data = (await response.json()) as { token: string };
  console.log(`✅ Successfully authenticated with ArgoCD`);
  return data.token;
}

export async function getArgoApplication(
  argoUrl: string,
  username: string,
  password: string,
  appName: string
): Promise<ArgoApplication | null> {
  return retryWithBackoff(async () => {
    console.log(`🔗 Connecting to ArgoCD: ${argoUrl}`);
    console.log(`👤 Username: ${username}`);
    console.log(`📱 App name: ${appName}`);

    const token = await getArgoToken(argoUrl, username, password);

    const url = `${argoUrl}/api/v1/applications/${appName}`;
    console.log(`🌐 Request URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log(
      `📊 Response status: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      let errorBody = "";
      try {
        errorBody = await response.text();
        console.log(`❌ Error response body: ${errorBody}`);
      } catch (e) {
        console.log(`❌ Could not read error response body`);
      }

      if (response.status === 401) {
        throw new Error(
          `ArgoCD Authentication failed (401). Check ARGOCD_USER and ARGOCD_PASSWORD. Response: ${errorBody}`
        );
      } else if (response.status === 403) {
        throw new Error(
          `ArgoCD Access forbidden (403). User ${username} may not have access to app ${appName}. Response: ${errorBody}`
        );
      } else if (response.status === 404) {
        throw new Error(
          `ArgoCD Application not found (404). App ${appName} may not exist. Response: ${errorBody}`
        );
      } else {
        throw new Error(
          `ArgoCD API error: ${response.status} ${response.statusText}. Response: ${errorBody}`
        );
      }
    }

    const data = (await response.json()) as ArgoApplication;
    console.log(`✅ Successfully retrieved ArgoCD application data`);
    return data;
  }, 3);
}

export function getCurrentRevision(argoApp: ArgoApplication): string {
  return argoApp.status.sync.revision;
}

export function getPreviousRevision(argoApp: ArgoApplication): string {
  return (
    argoApp.status.operationState?.operation?.sync?.revision ??
    argoApp.status.history?.[argoApp.status.history.length - 1]?.revision ??
    ""
  );
}

export function isDeploymentReady(
  argoApp: ArgoApplication,
  deploymentName: string
): boolean {
  const isSynced = argoApp.status?.sync?.status === "Synced";
  const isHealthy = argoApp.status?.health?.status === "Healthy";

  if (!isSynced || !isHealthy) {
    return false;
  }

  if (argoApp.status?.resources) {
    const deployment = argoApp.status.resources.find(
      (resource) =>
        resource.kind === "Deployment" && resource.name === deploymentName
    );

    if (deployment) {
      return (
        deployment.status === "Synced" &&
        deployment.health?.status === "Healthy"
      );
    }
  }

  return true;
}

export function isRevisionDeployed(
  argoApp: ArgoApplication,
  revision: string
): boolean {
  const currentRevision = getCurrentRevision(argoApp);

  return (
    currentRevision === revision ||
    currentRevision.startsWith(revision) ||
    revision.startsWith(currentRevision.substring(0, 8))
  );
}

export function getRevisionSyncStatus(
  argoApp: ArgoApplication,
  revision: string
): {
  isDeployed: boolean;
  isSynced: boolean;
  isHealthy: boolean;
} {
  const isDeployed = isRevisionDeployed(argoApp, revision);
  const isSynced = argoApp.status?.sync?.status === "Synced";
  const isHealthy = argoApp.status?.health?.status === "Healthy";

  return {
    isDeployed,
    isSynced,
    isHealthy,
  };
}
