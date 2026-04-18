import { neon } from "@netlify/neon";

let sqlInstance;

export function getSql() {
  if (!sqlInstance) {
    sqlInstance = neon();
  }

  return sqlInstance;
}
