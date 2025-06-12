declare global {
  interface ArgoApplication {
    metadata: {
      name: string;
      namespace?: string;
      uid: string;
      creationTimestamp: string;
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
    };

    spec: {
      project: string;
      source: {
        repoURL: string;
        targetRevision: string;
        path?: string;
        helm?: {
          valueFiles?: string[];
          parameters?: Array<{ name: string; value: string }>;
        };
        kustomize?: {
          namePrefix?: string;
          nameSuffix?: string;
          images?: string[];
        };
      };
      destination: {
        server: string;
        namespace: string;
      };
      syncPolicy?: {
        automated?: {
          prune?: boolean;
          selfHeal?: boolean;
          allowEmpty?: boolean;
        };
        syncOptions?: string[];
      };
      revisionHistoryLimit?: number;
    };

    status: {
      health: {
        status:
          | "Healthy"
          | "Progressing"
          | "Degraded"
          | "Suspended"
          | "Missing"
          | "Unknown";
      };
      sync: {
        status: "Synced" | "OutOfSync" | "Unknown";
        revision: string;
        comparedTo: {
          source: ArgoApplication["spec"]["source"];
          destination: ArgoApplication["spec"]["destination"];
        };
      };
      conditions?: Array<{
        type: string;
        message: string;
        lastTransitionTime?: string;
      }>;
      history?: Array<{
        id: number;
        revision: string;
        deployedAt: string;
        deployStartedAt?: string;
        source: ArgoApplication["spec"]["source"];
      }>;
      operationState?: {
        operation: {
          initiatedBy?: {
            username: string;
          };
          retry?: any;
          sync?: {
            revision: string;
            syncStrategy?: {
              hook?: {};
            };
          };
        };
        phase?: "Running" | "Succeeded" | "Failed" | string;
        message?: string;
        startedAt: string;
        finishedAt?: string;
      };
      resources?: Array<{
        kind: string;
        namespace: string;
        name: string;
        status: string;
        health?: {
          status: string;
          message?: string;
        };
      }>;
    };
  }
}

export {};
