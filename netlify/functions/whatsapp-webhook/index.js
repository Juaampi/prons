import { badRequest, jsonResponse, methodNotAllowed, serverError } from "../../../lib/http.js";
import { getEnv } from "../../../lib/env.js";
import { createOutboundMessage, processWhatsappWebhook, verifyWebhookSignature } from "../../../lib/whatsapp-inbox.js";
import { createWebhookEvent } from "../../../lib/whatsapp-webhook-events.js";
import { sendWhatsappTextMessage } from "../../../lib/whatsapp.js";
import { GENERIC_FALLBACK_TEXT, generateAIResponse } from "../../../lib/whatsapp-ai.js";

function getQueryValue(event, key) {
  return event.queryStringParameters?.[key] || event.multiValueQueryStringParameters?.[key]?.[0] || "";
}

function getEventType(payload) {
  if (payload?.field) {
    return payload.field;
  }

  if (Array.isArray(payload?.entry)) {
    const firstField = payload.entry?.[0]?.changes?.[0]?.field;
    return firstField || "entry";
  }

  if (payload?.messages) {
    return "messages";
  }

  if (payload?.statuses) {
    return "statuses";
  }

  return "unknown";
}

export async function handler(event) {
  if (event.httpMethod === "GET") {
    const mode = getQueryValue(event, "hub.mode");
    const verifyToken = getQueryValue(event, "hub.verify_token");
    const challenge = getQueryValue(event, "hub.challenge");

    if (mode !== "subscribe" || !challenge) {
      return badRequest("Webhook verification payload invalido");
    }

    if (verifyToken !== getEnv("WHATSAPP_VERIFY_TOKEN")) {
      return jsonResponse(403, { ok: false, error: "Webhook verify token invalido" });
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
      body: challenge,
    };
  }

  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["GET", "POST"]);
  }

  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body || "{}";
    const signatureHeader =
      event.headers["x-hub-signature-256"] || event.headers["X-Hub-Signature-256"] || "";
    const signature = verifyWebhookSignature(rawBody, signatureHeader);
    let payload = null;

    if (signature.enabled && !signature.valid) {
      try {
        payload = JSON.parse(rawBody);
      } catch (error) {
        payload = { parse_error: true };
      }

      await createWebhookEvent({
        eventType: getEventType(payload),
        signatureValid: false,
        headers: event.headers,
        rawBody: payload,
        processingResult: { rejected: true, reason: "invalid_signature" },
      });

      return jsonResponse(401, { ok: false, error: "Firma de webhook invalida" });
    }

    payload = JSON.parse(rawBody);
    const summary = await processWhatsappWebhook(payload);

    if (Array.isArray(summary.inboundEvents) && summary.inboundEvents.length) {
      for (const inboundEvent of summary.inboundEvents) {
        const incomingMessageText = String(inboundEvent.textBody || "").trim();
        let autoReplyText = GENERIC_FALLBACK_TEXT;

        console.info("WhatsApp inbound message received", {
          phone: inboundEvent.phone,
          waMessageId: inboundEvent.waMessageId,
          hasText: Boolean(incomingMessageText),
        });

        try {
          autoReplyText = await generateAIResponse(incomingMessageText);
          console.info("WhatsApp AI response generated", {
            phone: inboundEvent.phone,
            replyPreview: autoReplyText.slice(0, 160),
          });
        } catch (aiError) {
          console.error("WhatsApp AI response failed", {
            phone: inboundEvent.phone,
            error: String(aiError?.message || aiError),
          });
          autoReplyText = GENERIC_FALLBACK_TEXT;
        }

        try {
          const response = await sendWhatsappTextMessage({
            to: inboundEvent.phone,
            text: autoReplyText,
          });

          await createOutboundMessage({
            conversationId: inboundEvent.conversationId,
            phone: inboundEvent.phone,
            customerName: inboundEvent.customerName,
            messageType: "text",
            textBody: autoReplyText,
            waMessageId: response?.result?.messages?.[0]?.id || null,
            status: response.mocked ? "mocked" : "sent",
            rawPayload: response.result,
            sentByUserId: null,
          });
        } catch (autoReplyError) {
          console.error("WhatsApp auto-reply failed", {
            phone: inboundEvent.phone,
            error: String(autoReplyError?.message || autoReplyError),
          });
        }
      }
    }

    await createWebhookEvent({
      eventType: getEventType(payload),
      signatureValid: signature.valid,
      headers: event.headers,
      rawBody: payload,
      processingResult: {
        ...summary,
        inboundEvents: summary.inboundEvents?.length || 0,
        autoReplyAttempted: Boolean(summary.inboundEvents?.length),
      },
    });

    if (summary.inboundMessages || summary.statusUpdates) {
      console.info("WhatsApp webhook procesado", summary);
    }

    return jsonResponse(200, { ok: true });
  } catch (error) {
    return serverError(error, "No se pudo procesar el webhook de WhatsApp");
  }
}
