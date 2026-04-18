import { getAdminSession } from "../../../lib/auth.js";
import { jsonResponse, methodNotAllowed } from "../../../lib/http.js";

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const session = await getAdminSession(event);

  return jsonResponse(200, {
    ok: true,
    authenticated: Boolean(session?.role === "admin"),
    user: session?.role === "admin" ? { identifier: session.sub } : null,
  });
}
