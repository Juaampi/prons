import { requireAdmin } from "../../../lib/auth.js";
import { badRequest, jsonResponse, methodNotAllowed, serverError } from "../../../lib/http.js";
import { getConversationDetail } from "../../../lib/whatsapp-inbox.js";

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
    const conversationId = params.get("id");

    if (!conversationId) {
      return badRequest("Conversation id is required");
    }

    const detail = await getConversationDetail(conversationId);

    if (!detail) {
      return badRequest("Conversation not found");
    }

    return jsonResponse(200, { ok: true, ...detail });
  } catch (error) {
    return serverError(error, "No se pudo obtener la conversacion");
  }
}
