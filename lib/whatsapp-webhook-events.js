import { getSql } from "./db.js";

function sanitizeHeaders(headers = {}) {
  const safeEntries = Object.entries(headers || {}).map(([key, value]) => [
    String(key),
    Array.isArray(value) ? value.join(",") : String(value ?? ""),
  ]);

  return Object.fromEntries(safeEntries);
}

export async function createWebhookEvent({
  eventType = "unknown",
  signatureValid = null,
  headers = {},
  rawBody = null,
  processingResult = null,
}) {
  const sql = getSql();
  const [event] = await sql`
    INSERT INTO whatsapp_webhook_events (
      event_type,
      signature_valid,
      http_headers,
      raw_body,
      processing_result
    ) VALUES (
      ${eventType},
      ${signatureValid},
      ${JSON.stringify(sanitizeHeaders(headers))}::jsonb,
      ${rawBody ? JSON.stringify(rawBody) : null}::jsonb,
      ${processingResult ? JSON.stringify(processingResult) : null}::jsonb
    )
    RETURNING
      id,
      event_type,
      signature_valid,
      created_at
  `;

  return event;
}
