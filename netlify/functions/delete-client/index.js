import { deleteClientRecord, getClientById } from "../../../lib/clients.js";
import { requireAdmin } from "../../../lib/auth.js";
import { badRequest, jsonResponse, methodNotAllowed, parseJsonBody, serverError } from "../../../lib/http.js";

export async function handler(event) {
  if (!["POST", "DELETE"].includes(event.httpMethod)) {
    return methodNotAllowed(["POST", "DELETE"]);
  }

  const auth = await requireAdmin(event);

  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const payload = await parseJsonBody(event);
    const clientId = Number(payload.clientId);

    if (!clientId) {
      return badRequest("Client id is required");
    }

    const existingClient = await getClientById(clientId);

    if (!existingClient) {
      return badRequest("Client not found");
    }

    await deleteClientRecord(clientId);

    return jsonResponse(200, { ok: true, deletedId: clientId });
  } catch (error) {
    return serverError(error, "No se pudo eliminar el cliente");
  }
}
