// Standalone DB bootstrap: `node sqlite/init.mjs`
// Plain .mjs (not .ts) so it runs with no build step / extra tooling.
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(process.cwd(), process.env.SQLITE_DB_PATH || "./data/ecom.db");
const migrationsDir = resolve(here, "migrations");
const baselineMigration = "0000_init.sql";

mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.function("gen_random_uuid", () => randomUUID());
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");

const alreadyInitialized = Boolean(
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get(),
);

db.exec(
  "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));",
);

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

function markApplied(name) {
  db.prepare("INSERT OR IGNORE INTO _migrations (name) VALUES (?)").run(name);
}

if (!alreadyInitialized) {
  const sql = readFileSync(resolve(migrationsDir, baselineMigration), "utf-8");
  db.exec(sql);
  for (const file of files) markApplied(file);
  console.log(`ECOM SQLite database created and migrated at ${dbPath}`);
} else {
  const applied = new Set(db.prepare("SELECT name FROM _migrations").all().map((r) => r.name));
  if (!applied.has(baselineMigration)) markApplied(baselineMigration);

  let ranAny = false;
  for (const file of files) {
    if (file === baselineMigration || applied.has(file)) continue;
    const sql = readFileSync(resolve(migrationsDir, file), "utf-8");
    db.exec(sql);
    markApplied(file);
    console.log(`Applied migration ${file}`);
    ranAny = true;
  }
  console.log(
    ranAny
      ? `ECOM SQLite database at ${dbPath} caught up to the latest migrations.`
      : `ECOM SQLite database already initialized at ${dbPath} — nothing to do.`,
  );
}

db.close();
