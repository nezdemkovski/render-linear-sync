export interface RenderWebhookPayload {
  type: string;
  timestamp: string;
  data: {
    id: string;
    serviceId: string;
    serviceName: string;
    status: string;
  };
}
