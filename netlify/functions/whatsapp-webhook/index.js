import { badRequest, jsonResponse, methodNotAllowed, serverError } from "../../../lib/http.js";
import { getEnv } from "../../../lib/env.js";
import { processWhatsappWebhook, verifyWebhookSignature } from "../../../lib/whatsapp-inbox.js";
import { createWebhookEvent } from "../../../lib/whatsapp-webhook-events.js";

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
    await createWebhookEvent({
      eventType: getEventType(payload),
      signatureValid: signature.valid,
      headers: event.headers,
      rawBody: payload,
      processingResult: summary,
    });

    if (summary.inboundMessages || summary.statusUpdates) {
      console.info("WhatsApp webhook procesado", summary);
    }

    return jsonResponse(200, { ok: true });
  } catch (error) {
    return serverError(error, "No se pudo procesar el webhook de WhatsApp");
  }
}
