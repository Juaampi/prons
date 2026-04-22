import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { getSql } from "../lib/db.js";

dotenv.config();

if (!process.env.NETLIFY_DATABASE_URL) {
  try {
    const resolved = execSync("npx netlify env:get NETLIFY_DATABASE_URL", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();

    if (resolved) {
      process.env.NETLIFY_DATABASE_URL = resolved;
    }
  } catch (error) {
    // Fall back to the local .env file if CLI resolution is not available.
  }
}

const sql = getSql();
const migrationsDir = path.resolve("migrations");
const entries = await fs.readdir(migrationsDir);
const migrationFiles = entries
  .filter((entry) => entry.endsWith(".sql"))
  .filter((entry) => !entry.startsWith("0000_"))
  .sort((left, right) => left.localeCompare(right, "en"));

await sql.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id BIGSERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

for (const file of migrationFiles) {
  const [alreadyApplied] = await sql.query(
    `SELECT filename FROM schema_migrations WHERE filename = $1 LIMIT 1`,
    [file]
  );

  if (alreadyApplied) {
    console.log("Skipping already applied migration:", file);
    continue;
  }

  const migrationPath = path.join(migrationsDir, file);
  const migrationSql = await fs.readFile(migrationPath, "utf8");
  const statements = migrationSql
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }

  await sql.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);

  console.log("Migration applied:", migrationPath);
}
