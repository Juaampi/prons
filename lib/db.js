import { neon } from "@neondatabase/serverless";

let sqlInstance;

export function getSql() {
  if (!sqlInstance) {
    if (!process.env.NETLIFY_DATABASE_URL) {
      throw new Error("Falta configurar NETLIFY_DATABASE_URL");
    }

    sqlInstance = neon(process.env.NETLIFY_DATABASE_URL);
  }

  return sqlInstance;
}
