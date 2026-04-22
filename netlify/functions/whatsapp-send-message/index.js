import { requireAdmin } from "../../../lib/auth.js";
import { badRequest, jsonResponse, methodNotAllowed, parseJsonBody, serverError } from "../../../lib/http.js";
import { sendWhatsappTextMessage } from "../../../lib/whatsapp.js";
import { createOutboundMessage, getConversationDetail } from "../../../lib/whatsapp-inbox.js";

function normalizePhone(phone) {
  return String(phone || "").trim().replace(/[^\d]/g, "");
}

function getMetaErrorMessage(error) {
  if (error?.details?.error_data?.details) {
    return error.details.error_data.details;
  }

  if (error?.message) {
    return error.message;
  }

  return "No se pudo enviar el mensaje";
}

function isOutsideCustomerCareWindow(error) {
  const detail = `${error?.message || ""} ${error?.details?.error_data?.details || ""}`.toLowerCase();
  return detail.includes("24 hours") || detail.includes("24-hour") || detail.includes("customer care window");
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
    const conversationId = payload?.conversationId ? Number(payload.conversationId) : null;
    const text = String(payload?.text || "").trim();

    if (!text) {
      return badRequest("El texto del mensaje es obligatorio");
    }

    if (text.length > 4096) {
      return badRequest("El mensaje es demasiado largo");
    }

    let phone = normalizePhone(payload?.phone);
    let customerName = null;

    if (conversationId) {
      const detail = await getConversationDetail(conversationId);

      if (!detail?.conversation) {
        return badRequest("Conversation not found");
      }

      phone = detail.conversation.customer_phone;
      customerName = detail.conversation.customer_name;
    }

    if (!phone) {
      return badRequest("El telefono de destino es obligatorio");
    }

    const response = await sendWhatsappTextMessage({ to: phone, text });
    const waMessageId = response?.result?.messages?.[0]?.id || null;
    const saved = await createOutboundMessage({
      conversationId,
      phone,
      customerName,
      messageType: "text",
      textBody: text,
      waMessageId,
      status: response.mocked ? "mocked" : "sent",
      rawPayload: response.result,
      sentByUserId: auth.session.uid || null,
    });

    return jsonResponse(200, {
      ok: true,
      conversationId: saved.conversationId,
      message: saved.message,
      mocked: Boolean(response.mocked),
    });
  } catch (error) {
    const statusCode = isOutsideCustomerCareWindow(error) ? 409 : 500;

    return jsonResponse(statusCode, {
      ok: false,
      error: isOutsideCustomerCareWindow(error)
        ? "El cliente esta fuera de la ventana de 24 horas. Envia un template aprobado desde Meta para reabrir la conversacion."
        : getMetaErrorMessage(error),
      metaCode: error?.code || null,
    });
  }
}
