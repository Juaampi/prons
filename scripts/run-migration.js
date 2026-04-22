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
  .sort((left, right) => left.localeCompare(right, "en"));

for (const file of migrationFiles) {
  const migrationPath = path.join(migrationsDir, file);
  const migrationSql = await fs.readFile(migrationPath, "utf8");
  const statements = migrationSql
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }

  console.log("Migration applied:", migrationPath);
}
