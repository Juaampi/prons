export function jsonResponse(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
    body: JSON.stringify(payload),
  };
}

export function methodNotAllowed(allowed = ["GET"]) {
  return jsonResponse(405, { ok: false, error: "Method not allowed" }, { Allow: allowed.join(", ") });
}

export function badRequest(message, details) {
  return jsonResponse(400, { ok: false, error: message, details });
}

export function unauthorized(message = "Unauthorized") {
  return jsonResponse(401, { ok: false, error: message });
}

export function serverError(error, fallback = "Internal server error") {
  console.error(error);

  return jsonResponse(500, {
    ok: false,
    error: fallback,
    detail: process.env.NODE_ENV === "development" ? String(error?.message || error) : undefined,
  });
}

export async function parseJsonBody(event) {
  if (!event.body) {
    return {};
  }

  return JSON.parse(event.body);
}
