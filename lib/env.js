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

function normalizeSiteUrl(url) {
  const value = String(url || "").trim();

  if (!value) {
    return "";
  }

  return value.replace(/\/+$/, "");
}

function isLocalUrl(url) {
  return /localhost|127\.0\.0\.1/i.test(String(url || ""));
}

export function getSiteUrl() {
  const preferred = [
    normalizeSiteUrl(getEnv("SITE_URL")),
    normalizeSiteUrl(getEnv("URL")),
    normalizeSiteUrl(getEnv("DEPLOY_PRIME_URL")),
  ].filter(Boolean);

  const publicUrl = preferred.find((value) => !isLocalUrl(value));

  if (publicUrl) {
    return publicUrl;
  }

  const localUrl = preferred.find(Boolean);

  if (localUrl && !isProductionRuntime()) {
    return localUrl;
  }

  return "https://prons.com.ar";
}
