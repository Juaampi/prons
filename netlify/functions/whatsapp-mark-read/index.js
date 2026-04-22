import { requireAdmin } from "../../../lib/auth.js";
import { badRequest, jsonResponse, methodNotAllowed, parseJsonBody, serverError } from "../../../lib/http.js";
import { markConversationAsRead } from "../../../lib/whatsapp-inbox.js";

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
    const conversationId = Number(payload?.conversationId);

    if (!conversationId) {
      return badRequest("Conversation id is required");
    }

    const conversation = await markConversationAsRead(conversationId);

    return jsonResponse(200, { ok: true, conversation });
  } catch (error) {
    return serverError(error, "No se pudo marcar la conversacion como leida");
  }
}
