export function getEnv(name, fallback = "") {
  return process.env[name] ?? fallback;
}

export function getRequiredEnv(name) {
  const value = getEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function isProductionRuntime() {
  return getEnv("CONTEXT") === "production" || getEnv("NODE_ENV") === "production";
}

export function getSiteUrl() {
  return (
    getEnv("SITE_URL") ||
    getEnv("URL") ||
    getEnv("DEPLOY_PRIME_URL") ||
    "http://localhost:8888"
  );
}
