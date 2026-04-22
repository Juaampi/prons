import { requireAdmin } from "../../../lib/auth.js";
import { jsonResponse, methodNotAllowed, serverError } from "../../../lib/http.js";
import { listConversations } from "../../../lib/whatsapp-inbox.js";

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const auth = await requireAdmin(event);

  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = new URLSearchParams(event.queryStringParameters || {});
    const result = await listConversations({
      page: params.get("page") || "1",
      pageSize: params.get("pageSize") || "25",
      query: params.get("q") || "",
      unreadOnly: params.get("unread") === "1",
    });

    return jsonResponse(200, { ok: true, ...result });
  } catch (error) {
    return serverError(error, "No se pudieron obtener las conversaciones");
  }
}
