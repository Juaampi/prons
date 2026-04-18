import { listClients } from "../../../lib/clients.js";
import { requireAdmin } from "../../../lib/auth.js";
import { jsonResponse, methodNotAllowed, serverError } from "../../../lib/http.js";

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
    const query = params.get("q") || "";
    const result = await listClients({ query, page: 1, pageSize: 20 });
    return jsonResponse(200, { ok: true, ...result });
  } catch (error) {
    return serverError(error, "No se pudieron buscar los clientes");
  }
}
