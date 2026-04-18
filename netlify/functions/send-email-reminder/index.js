import { requireAdmin } from "../../../lib/auth.js";
import { getClientById } from "../../../lib/clients.js";
import { sendReminderEmail } from "../../../lib/email.js";
import { badRequest, jsonResponse, methodNotAllowed, parseJsonBody, serverError } from "../../../lib/http.js";

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
    const clientId = Number(payload.clientId);

    if (!clientId) {
      return badRequest("Client id is required");
    }

    const client = await getClientById(clientId);

    if (!client) {
      return badRequest("Client not found");
    }

    const result = await sendReminderEmail(client);
    return jsonResponse(200, { ok: true, result });
  } catch (error) {
    return serverError(error, "No se pudo enviar el recordatorio por email");
  }
}
