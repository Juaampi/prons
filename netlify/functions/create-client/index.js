import { createClientRecord } from "../../../lib/clients.js";
import { sendNewLeadEmail } from "../../../lib/email.js";
import { badRequest, jsonResponse, methodNotAllowed, parseJsonBody, serverError } from "../../../lib/http.js";
import { validateClientPayload } from "../../../lib/validation.js";
import { sendNewLeadWhatsapp } from "../../../lib/whatsapp.js";

function getCreateClientErrorMessage(error) {
  const message = String(error?.message || error || "");
  const code = String(error?.code || "");

  if (message.includes("NETLIFY_DATABASE_URL")) {
    return "La base de datos no esta configurada en el deploy";
  }

  if (message.includes('relation "clients" does not exist') || code === "42P01") {
    return "La base de datos no tiene la tabla de clientes creada";
  }

  if (
    message.includes("connect") ||
    message.includes("connection") ||
    message.includes("fetch failed") ||
    code === "ECONNREFUSED"
  ) {
    return "No se pudo conectar con la base de datos";
  }

  return "No se pudo registrar la consulta";
}

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
    return serverError(error, getCreateClientErrorMessage(error));
  }
}
