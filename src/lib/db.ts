import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "wanosend.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  }
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS send_job (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      from_name TEXT NOT NULL,
      from_address TEXT NOT NULL,
      reply_to TEXT,
      html TEXT NOT NULL,
      rate_config TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total INTEGER NOT NULL DEFAULT 0,
      sent INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipient_result (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      email TEXT NOT NULL,
      merge_data TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      resend_message_id TEXT,
      error TEXT,
      batch_index INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES send_job(id)
    );

    CREATE TABLE IF NOT EXISTS suppression (
      email TEXT PRIMARY KEY,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_recipient_result_job_id ON recipient_result(job_id);
    CREATE INDEX IF NOT EXISTS idx_recipient_result_status ON recipient_result(status);
  `);
}
