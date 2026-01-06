import { Database } from "bun:sqlite";
import type { ProcessedTicket } from "../../types/database";

let db: Database | null = null;

export const initDatabase = (dbPath: string = "./render-linear-sync.db") => {
  if (db) {
    return db;
  }

  db = new Database(dbPath, { create: true });

  db.run(`
    CREATE TABLE IF NOT EXISTS processed_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      ticket_title TEXT NOT NULL,
      previous_state TEXT NOT NULL,
      new_state TEXT NOT NULL,
      processed_at TEXT NOT NULL,
      deploy_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      commit_id TEXT NOT NULL,
      commit_message TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_ticket_id ON processed_tickets(ticket_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_processed_at ON processed_tickets(processed_at)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_deploy_id ON processed_tickets(deploy_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_service_id ON processed_tickets(service_id)
  `);

  console.log(`[INFO] Database initialized at ${dbPath}`);

  return db;
};

export const getDatabase = () => {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
};

export const saveProcessedTicket = (
  ticketId: string,
  ticketTitle: string,
  previousState: string,
  newState: string,
  deployId: string,
  serviceId: string,
  serviceName: string,
  commitId: string,
  commitMessage: string
) => {
  const database = getDatabase();

  const query = database.query(`
    INSERT INTO processed_tickets (
      ticket_id,
      ticket_title,
      previous_state,
      new_state,
      processed_at,
      deploy_id,
      service_id,
      service_name,
      commit_id,
      commit_message
    ) VALUES (
      $ticketId,
      $ticketTitle,
      $previousState,
      $newState,
      $processedAt,
      $deployId,
      $serviceId,
      $serviceName,
      $commitId,
      $commitMessage
    )
  `);

  query.run({
    $ticketId: ticketId,
    $ticketTitle: ticketTitle,
    $previousState: previousState,
    $newState: newState,
    $processedAt: new Date().toISOString(),
    $deployId: deployId,
    $serviceId: serviceId,
    $serviceName: serviceName,
    $commitId: commitId,
    $commitMessage: commitMessage,
  });
};

export const getProcessedTickets = (limit: number = 100) => {
  const database = getDatabase();

  const query = database.query(`
    SELECT * FROM processed_tickets
    ORDER BY processed_at DESC
    LIMIT $limit
  `);

  return query.all({ $limit: limit }) as ProcessedTicket[];
};

export const getTicketHistory = (ticketId: string) => {
  const database = getDatabase();

  const query = database.query(`
    SELECT * FROM processed_tickets
    WHERE ticket_id = $ticketId
    ORDER BY processed_at DESC
  `);

  return query.all({ $ticketId: ticketId }) as ProcessedTicket[];
};

export const wasDeployProcessed = (deployId: string) => {
  const database = getDatabase();

  const query = database.query(`
    SELECT COUNT(*) as count FROM processed_tickets
    WHERE deploy_id = $deployId
  `);

  const result = query.get({
    $deployId: deployId,
  }) as { count: number };

  return result.count > 0;
};

export const wasTicketProcessedForDeploy = (
  ticketId: string,
  deployId: string
) => {
  const database = getDatabase();

  const query = database.query(`
    SELECT COUNT(*) as count FROM processed_tickets
    WHERE ticket_id = $ticketId
      AND deploy_id = $deployId
  `);

  const result = query.get({
    $ticketId: ticketId,
    $deployId: deployId,
  }) as { count: number };

  return result.count > 0;
};

export const closeDatabase = () => {
  if (db) {
    db.close(false);
    db = null;
  }
};
