// Standalone DB bootstrap: `node sqlite/init.mjs`
// Plain .mjs (not .ts) so it runs with no build step / extra tooling.
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(process.cwd(), process.env.SQLITE_DB_PATH || "./data/ecom.db");
const migrationPath = resolve(here, "migrations/0000_init.sql");

mkdirSync(dirname(dbPath), { recursive: true });
const isNewFile = !existsSync(dbPath);

const db = new DatabaseSync(dbPath);
db.function("gen_random_uuid", () => randomUUID());
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");

const alreadyInitialized = Boolean(
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get(),
);

if (isNewFile || !alreadyInitialized) {
  const sql = readFileSync(migrationPath, "utf-8");
  db.exec(sql);
  console.log(`ECOM SQLite database created and migrated at ${dbPath}`);
} else {
  console.log(`ECOM SQLite database already initialized at ${dbPath} — nothing to do.`);
}

db.close();
