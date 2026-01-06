import { retryWithBackoff } from "./utils";
import type { RenderService, RenderDeploy } from "../../types/render";

const RENDER_API_BASE = "https://api.render.com/v1";

const renderApiRequest = async <T>(
  endpoint: string,
  apiKey: string,
  params?: Record<string, string>
) => {
  const url = new URL(`${RENDER_API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Render API error: ${response.status} ${response.statusText}. ${errorText}`
    );
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    if (data.length > 0 && typeof data[0] === "object") {
      const firstItem = data[0];

      if ("owner" in firstItem) {
        return data.map((item: any) => item.owner) as T;
      }
      if ("service" in firstItem) {
        return data.map((item: any) => item.service) as T;
      }
      if ("deploy" in firstItem) {
        return data.map((item: any) => item.deploy) as T;
      }
    }
    return data as T;
  }

  if (data && typeof data === "object") {
    if ("items" in data && Array.isArray(data.items)) {
      return data.items as T;
    }
    if ("data" in data && Array.isArray(data.data)) {
      return data.data as T;
    }
  }

  return data as T;
};

export const listServices = (apiKey: string, workspaceId?: string) => {
  return retryWithBackoff(async () => {
    const params: Record<string, string> = {};
    if (workspaceId) {
      params.ownerId = workspaceId;
    }

    const response = await renderApiRequest<RenderService[]>(
      "/services",
      apiKey,
      params
    );
    return response;
  });
};

export const getService = (apiKey: string, serviceId: string) => {
  return retryWithBackoff(async () => {
    try {
      const response = await renderApiRequest<RenderService>(
        `/services/${serviceId}`,
        apiKey
      );
      return response;
    } catch (error) {
      return null;
    }
  });
};

export const listDeploys = (
  apiKey: string,
  serviceId: string,
  limit: number = 20
) => {
  return retryWithBackoff(async () => {
    const response = await renderApiRequest<RenderDeploy[]>(
      `/services/${serviceId}/deploys`,
      apiKey,
      { limit: limit.toString() }
    );
    return response;
  });
};
