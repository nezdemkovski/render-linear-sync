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

export {};
