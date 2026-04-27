import { createClientRecord } from "../../../lib/clients.js";
import { createClientActivityLog } from "../../../lib/client-activity.js";
import { requireAdmin } from "../../../lib/auth.js";
import { badRequest, jsonResponse, methodNotAllowed, parseJsonBody, serverError } from "../../../lib/http.js";
import { sanitizeText } from "../../../lib/sanitize.js";
import { validateClientPayload } from "../../../lib/validation.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const auth = await requireAdmin(event);

  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const payload = await parseJsonBody(event);
    const validation = validateClientPayload({
      ...payload,
      source: payload.source || "admin-crm",
    });

    if (!validation.success) {
      return badRequest("Invalid client payload", validation.errors);
    }

    const client = await createClientRecord({
      ...validation.data,
      status: sanitizeText(payload.status || "Contacto inicial"),
    });

    await createClientActivityLog({
      clientId: client.id,
      actionType: "client_created_manual",
      message: `${auth.session.name || auth.session.sub} creo el contacto.`,
      metadata: {
        source: client.source,
        status: client.status,
      },
      actorSession: auth.session,
    });

    return jsonResponse(200, { ok: true, client });
  } catch (error) {
    return serverError(error, "No se pudo crear el cliente");
  }
}
