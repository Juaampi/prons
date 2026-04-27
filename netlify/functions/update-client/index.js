import { getClientById, updateClientRecord } from "../../../lib/clients.js";
import { createClientActivityLog } from "../../../lib/client-activity.js";
import { requireAdmin } from "../../../lib/auth.js";
import { badRequest, jsonResponse, methodNotAllowed, parseJsonBody, serverError } from "../../../lib/http.js";
import { validateAdminClientUpdatePayload } from "../../../lib/validation.js";

export async function handler(event) {
  if (!["POST", "PATCH"].includes(event.httpMethod)) {
    return methodNotAllowed(["POST", "PATCH"]);
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

    const validation = validateAdminClientUpdatePayload(payload);

    if (!validation.success) {
      return badRequest("Invalid client payload", validation.errors);
    }

    const existingClient = await getClientById(clientId);

    if (!existingClient) {
      return badRequest("Client not found");
    }

    const previousStatus = existingClient.status;
    const client = await updateClientRecord(clientId, validation.data);

    if (previousStatus !== client.status) {
      await createClientActivityLog({
        clientId: client.id,
        actionType: "client_status_changed",
        message: `${auth.session.name || auth.session.sub} cambio el estado de "${previousStatus || "sin estado"}" a "${client.status}".`,
        metadata: {
          from: previousStatus || null,
          to: client.status,
        },
        actorSession: auth.session,
      });
    }

    const changedFields = [];

    if (existingClient.nombre !== client.nombre) changedFields.push("nombre");
    if (existingClient.email !== client.email) changedFields.push("email");
    if (existingClient.telefono !== client.telefono) changedFields.push("telefono");
    if (existingClient.tipo_proyecto !== client.tipo_proyecto) changedFields.push("proyecto");
    if (existingClient.solucion !== client.solucion) changedFields.push("solucion");
    if (existingClient.source !== client.source) changedFields.push("origen");

    if (changedFields.length) {
      await createClientActivityLog({
        clientId: client.id,
        actionType: "client_updated",
        message: `${auth.session.name || auth.session.sub} actualizo datos del cliente.`,
        metadata: {
          fields: changedFields,
        },
        actorSession: auth.session,
      });
    }

    return jsonResponse(200, { ok: true, client });
  } catch (error) {
    return serverError(error, "No se pudo actualizar el cliente");
  }
}
