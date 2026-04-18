import { createClientRecord } from "../../../lib/clients.js";
import { sendNewLeadEmail } from "../../../lib/email.js";
import { badRequest, jsonResponse, methodNotAllowed, parseJsonBody, serverError } from "../../../lib/http.js";
import { validateClientPayload } from "../../../lib/validation.js";
import { sendNewLeadWhatsapp } from "../../../lib/whatsapp.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  try {
    const payload = await parseJsonBody(event);
    const validation = validateClientPayload(payload);

    if (!validation.success) {
      return badRequest("Validation failed", validation.errors);
    }

    const client = await createClientRecord(validation.data);
    const notifications = await Promise.allSettled([
      sendNewLeadEmail(client),
      sendNewLeadWhatsapp(client),
    ]);

    return jsonResponse(201, {
      ok: true,
      client,
      notifications: notifications.map((item, index) => ({
        channel: index === 0 ? "email" : "whatsapp",
        ok: item.status === "fulfilled",
        detail: item.status === "fulfilled" ? item.value : String(item.reason?.message || item.reason),
      })),
    });
  } catch (error) {
    return serverError(error, "No se pudo registrar la consulta");
  }
}
