import { clearSessionCookie } from "../../../lib/auth.js";
import { jsonResponse, methodNotAllowed } from "../../../lib/http.js";

export async function handler(event) {
  if (!["POST", "GET"].includes(event.httpMethod)) {
    return methodNotAllowed(["POST", "GET"]);
  }

  return jsonResponse(200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
}
