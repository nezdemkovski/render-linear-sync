declare global {
  interface LinearIssue {
    id: string;
    identifier: string;
    title: string;
    state: {
      id: string;
      name: string;
    };
  }

  interface LinearState {
    id: string;
    name: string;
    type: string;
  }
}

export interface DeployTicketInfo {
  deployId: string;
  serviceId: string;
  serviceName: string;
  commitId: string;
  commitMessage: string;
  tickets: string[];
}

export {};
