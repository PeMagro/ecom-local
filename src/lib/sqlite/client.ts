import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Server-only: uses Node's built-in `node:sqlite` (stable, no native build
// step — important on Windows, where better-sqlite3 needs a C++ toolchain).
// Never import this file from client/browser code.

const DB_PATH = resolve(process.cwd(), process.env["SQLITE_DB_PATH"] || "./data/ecom.db");
const MIGRATIONS_DIR = resolve(process.cwd(), "sqlite/migrations");
const BASELINE_MIGRATION = "0000_init.sql";

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

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function markApplied(database: DatabaseSync, name: string) {
  database.prepare("INSERT OR IGNORE INTO _migrations (name) VALUES (?)").run(name);
}

/**
 * 0000_init.sql is kept as a full, up-to-date schema snapshot — a brand-new
 * database runs only that file, then every migration (0000 included) is
 * marked applied since the snapshot already has everything they'd add.
 * A pre-existing database instead runs whichever migrations after 0000 it's
 * missing, in order, so it catches up incrementally without re-running 0000.
 */
function migrate(database: DatabaseSync) {
  database.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));",
  );

  const files = listMigrationFiles();
  const freshDb = !isInitialized(database);

  if (freshDb) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, BASELINE_MIGRATION), "utf-8");
    database.exec(sql);
    for (const file of files) markApplied(database, file);
    return;
  }

  const applied = new Set(
    (database.prepare("SELECT name FROM _migrations").all() as Array<{ name: string }>).map(
      (r) => r.name,
    ),
  );
  if (!applied.has(BASELINE_MIGRATION)) markApplied(database, BASELINE_MIGRATION);

  for (const file of files) {
    if (file === BASELINE_MIGRATION || applied.has(file)) continue;
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf-8");
    database.exec(sql);
    markApplied(database, file);
  }
}

/** Returns a process-wide singleton connection, creating + migrating the DB file on first use. */
export function getDb(): DatabaseSync {
  if (db) return db;

  mkdirSync(dirname(DB_PATH), { recursive: true });

  db = new DatabaseSync(DB_PATH);
  bootstrap(db);
  migrate(db);

  return db;
}
