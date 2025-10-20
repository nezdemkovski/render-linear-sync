import { Database } from "bun:sqlite";

export interface ProcessedTicket {
  id: number;
  ticket_id: string;
  ticket_title: string;
  previous_state: string;
  new_state: string;
  processed_at: string;
  revision_from: string;
  revision_to: string;
}

let db: Database | null = null;

export function initDatabase(
  dbPath: string = "./argocd-linear-sync.db"
): Database {
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
      revision_from TEXT NOT NULL,
      revision_to TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_ticket_id ON processed_tickets(ticket_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_processed_at ON processed_tickets(processed_at)
  `);

  console.log(`📊 Database initialized at ${dbPath}`);

  return db;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

export function saveProcessedTicket(
  ticketId: string,
  ticketTitle: string,
  previousState: string,
  newState: string,
  revisionFrom: string,
  revisionTo: string
): void {
  const database = getDatabase();

  const query = database.query(`
    INSERT INTO processed_tickets (
      ticket_id,
      ticket_title,
      previous_state,
      new_state,
      processed_at,
      revision_from,
      revision_to
    ) VALUES (
      $ticketId,
      $ticketTitle,
      $previousState,
      $newState,
      $processedAt,
      $revisionFrom,
      $revisionTo
    )
  `);

  query.run({
    $ticketId: ticketId,
    $ticketTitle: ticketTitle,
    $previousState: previousState,
    $newState: newState,
    $processedAt: new Date().toISOString(),
    $revisionFrom: revisionFrom,
    $revisionTo: revisionTo,
  });
}

export function getProcessedTickets(limit: number = 100): ProcessedTicket[] {
  const database = getDatabase();

  const query = database.query(`
    SELECT * FROM processed_tickets
    ORDER BY processed_at DESC
    LIMIT $limit
  `);

  return query.all({ $limit: limit }) as ProcessedTicket[];
}

export function getTicketHistory(ticketId: string): ProcessedTicket[] {
  const database = getDatabase();

  const query = database.query(`
    SELECT * FROM processed_tickets
    WHERE ticket_id = $ticketId
    ORDER BY processed_at DESC
  `);

  return query.all({ $ticketId: ticketId }) as ProcessedTicket[];
}

export function closeDatabase(): void {
  if (db) {
    db.close(false);
    db = null;
  }
}
