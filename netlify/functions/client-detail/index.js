import { getClientById } from "../../../lib/clients.js";
import { listClientActivityLogs } from "../../../lib/client-activity.js";
import { requireAdmin } from "../../../lib/auth.js";
import { badRequest, jsonResponse, methodNotAllowed, serverError } from "../../../lib/http.js";

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
    const clientId = params.get("id");

    if (!clientId) {
      return badRequest("Client id is required");
    }

    const client = await getClientById(clientId);

    if (!client) {
      return badRequest("Client not found");
    }

    const activities = await listClientActivityLogs(clientId);

    return jsonResponse(200, { ok: true, client, activities });
  } catch (error) {
    return serverError(error, "No se pudo obtener el cliente");
  }
}
