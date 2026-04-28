import { requireAdmin } from "../../../lib/auth.js";
import { getClientById } from "../../../lib/clients.js";
import { sendReminderWhatsapp } from "../../../lib/whatsapp.js";
import { badRequest, jsonResponse, methodNotAllowed, parseJsonBody } from "../../../lib/http.js";

function getMetaErrorMessage(error) {
  if (error?.details?.error_data?.details) {
    return error.details.error_data.details;
  }

  if (error?.message) {
    return error.message;
  }

  return "No se pudo enviar el recordatorio por WhatsApp";
}

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

    const result = await sendReminderWhatsapp(client);
    return jsonResponse(200, { ok: true, result });
  } catch (error) {
    console.error(error);

    return jsonResponse(500, {
      ok: false,
      error: getMetaErrorMessage(error),
      metaCode: error?.code || null,
    });
  }
}
