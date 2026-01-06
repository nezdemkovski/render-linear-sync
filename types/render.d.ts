export interface RenderService {
  id: string;
  name: string;
  type: string;
  ownerId: string;
  environmentId?: string;
  repo?: string;
  branch?: string;
  createdAt: string;
  updatedAt: string;
  serviceDetails?: {
    url?: string;
    plan?: string;
  };
}

export interface RenderDeploy {
  id: string;
  commit: {
    id: string;
    message: string;
    createdAt: string;
  };
  status: string;
  finishedAt?: string;
  createdAt: string;
}
