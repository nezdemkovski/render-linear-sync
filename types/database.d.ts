export interface ProcessedTicket {
  id: number;
  ticket_id: string;
  ticket_title: string;
  previous_state: string;
  new_state: string;
  processed_at: string;
  deploy_id: string;
  service_id: string;
  service_name: string;
  commit_id: string;
  commit_message: string;
}
