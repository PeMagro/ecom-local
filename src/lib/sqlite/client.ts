import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Server-only: uses Node's built-in `node:sqlite` (stable, no native build
// step — important on Windows, where better-sqlite3 needs a C++ toolchain).
// Never import this file from client/browser code.

const DB_PATH = resolve(process.cwd(), process.env["SQLITE_DB_PATH"] || "./data/ecom.db");
const MIGRATION_PATH = resolve(process.cwd(), "sqlite/migrations/0000_init.sql");

let db: DatabaseSync | undefined;

function bootstrap(database: DatabaseSync) {
  // Postgres had gen_random_uuid() built in; SQLite has no such function,
  // so every `DEFAULT (gen_random_uuid())` in the migration relies on this
  // being registered before the migration (or any insert) runs.
  database.function("gen_random_uuid", () => randomUUID());
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");
}

function isInitialized(database: DatabaseSync): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get();
  return Boolean(row);
}

function runMigration(database: DatabaseSync) {
  const sql = readFileSync(MIGRATION_PATH, "utf-8");
  database.exec(sql);
}

/** Returns a process-wide singleton connection, creating + migrating the DB file on first use. */
export function getDb(): DatabaseSync {
  if (db) return db;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  const isNewFile = !existsSync(DB_PATH);

  db = new DatabaseSync(DB_PATH);
  bootstrap(db);

  if (isNewFile || !isInitialized(db)) {
    runMigration(db);
  }

  return db;
}
