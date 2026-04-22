import crypto from "node:crypto";
import { getSql } from "./db.js";
import { getEnv } from "./env.js";

function normalizePhone(phone) {
  const value = String(phone || "").trim();
  const digits = value.replace(/[^\d]/g, "");
  return digits || value;
}

function getMessagePreview(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return "Mensaje sin texto";
  }

  return normalized.slice(0, 400);
}

function getIsoDate(value) {
  if (!value) {
    return new Date().toISOString();
  }

  if (typeof value === "number") {
    return new Date(value).toISOString();
  }

  const numeric = Number(value);

  if (!Number.isNaN(numeric) && String(value).length <= 13) {
    return new Date(numeric * (String(value).length <= 10 ? 1000 : 1)).toISOString();
  }

  return new Date(value).toISOString();
}

function extractMessageText(message) {
  if (!message || typeof message !== "object") {
    return "";
  }

  if (message.text?.body) {
    return message.text.body;
  }

  if (message.button?.text) {
    return message.button.text;
  }

  if (message.interactive?.button_reply?.title) {
    return message.interactive.button_reply.title;
  }

  if (message.interactive?.list_reply?.title) {
    return message.interactive.list_reply.title;
  }

  if (message.image?.caption) {
    return message.image.caption;
  }

  if (message.document?.caption) {
    return message.document.caption;
  }

  if (message.reaction?.emoji) {
    return message.reaction.emoji;
  }

  if (message.location) {
    return "Ubicacion compartida";
  }

  if (message.contacts) {
    return "Contacto compartido";
  }

  return "";
}

function buildStatusPreview(status) {
  const normalized = String(status || "").trim();
  return normalized ? `Estado actualizado: ${normalized}` : "Estado actualizado";
}

async function upsertConversation({
  customerPhone,
  customerName = null,
  lastMessageText = "",
  lastMessageAt = new Date().toISOString(),
  unreadIncrement = 0,
  assignedUserId = null,
}) {
  const sql = getSql();
  const phone = normalizePhone(customerPhone);
  const preview = getMessagePreview(lastMessageText);
  const safeAssignedUserId = assignedUserId ? Number(assignedUserId) : null;
  const [conversation] = await sql`
    INSERT INTO whatsapp_conversations (
      customer_phone,
      customer_name,
      last_message_at,
      last_message_text,
      unread_count,
      assigned_user_id
    ) VALUES (
      ${phone},
      ${customerName || null},
      ${lastMessageAt},
      ${preview},
      ${Math.max(0, Number(unreadIncrement) || 0)},
      ${safeAssignedUserId}
    )
    ON CONFLICT (customer_phone)
    DO UPDATE SET
      customer_name = COALESCE(EXCLUDED.customer_name, whatsapp_conversations.customer_name),
      last_message_at = EXCLUDED.last_message_at,
      last_message_text = EXCLUDED.last_message_text,
      unread_count = GREATEST(0, whatsapp_conversations.unread_count + ${Math.max(0, Number(unreadIncrement) || 0)}),
      assigned_user_id = COALESCE(whatsapp_conversations.assigned_user_id, EXCLUDED.assigned_user_id),
      updated_at = NOW()
    RETURNING
      id,
      customer_phone,
      customer_name,
      last_message_at,
      last_message_text,
      unread_count,
      assigned_user_id,
      created_at,
      updated_at
  `;

  return conversation;
}

export async function createInboundMessage({
  phone,
  customerName,
  messageType = "text",
  textBody = "",
  waMessageId = null,
  status = "received",
  rawPayload = null,
  occurredAt = null,
}) {
  const sql = getSql();
  const createdAt = getIsoDate(occurredAt);
  const conversation = await upsertConversation({
    customerPhone: phone,
    customerName,
    lastMessageText: textBody,
    lastMessageAt: createdAt,
    unreadIncrement: 1,
  });

  await sql`
    INSERT INTO whatsapp_messages (
      conversation_id,
      wa_message_id,
      direction,
      message_type,
      text_body,
      status,
      raw_payload,
      created_at
    ) VALUES (
      ${conversation.id},
      ${waMessageId},
      'inbound',
      ${messageType || "text"},
      ${textBody || null},
      ${status || "received"},
      ${rawPayload ? JSON.stringify(rawPayload) : null}::jsonb,
      ${createdAt}
    )
    ON CONFLICT DO NOTHING
  `;

  return conversation;
}

export async function createOutboundMessage({
  conversationId = null,
  phone = null,
  customerName = null,
  messageType = "text",
  textBody = "",
  waMessageId = null,
  status = "sent",
  rawPayload = null,
  sentByUserId = null,
  occurredAt = null,
}) {
  const sql = getSql();
  const createdAt = getIsoDate(occurredAt);
  let conversation = null;

  if (conversationId) {
    const [existingConversation] = await sql`
      SELECT
        id,
        customer_phone,
        customer_name,
        assigned_user_id
      FROM whatsapp_conversations
      WHERE id = ${Number(conversationId)}
      LIMIT 1
    `;

    if (existingConversation) {
      conversation = existingConversation;

      await sql`
        UPDATE whatsapp_conversations
        SET
          customer_name = COALESCE(${customerName || null}, customer_name),
          last_message_at = ${createdAt},
          last_message_text = ${getMessagePreview(textBody)},
          assigned_user_id = COALESCE(assigned_user_id, ${sentByUserId ? Number(sentByUserId) : null}),
          updated_at = NOW()
        WHERE id = ${existingConversation.id}
      `;
    }
  }

  if (!conversation) {
    conversation = await upsertConversation({
      customerPhone: phone,
      customerName,
      lastMessageText: textBody,
      lastMessageAt: createdAt,
      unreadIncrement: 0,
      assignedUserId: sentByUserId,
    });
  }

  await sql`
    INSERT INTO whatsapp_messages (
      conversation_id,
      wa_message_id,
      direction,
      message_type,
      text_body,
      status,
      raw_payload,
      sent_by_user_id,
      created_at
    ) VALUES (
      ${conversation.id},
      ${waMessageId},
      'outbound',
      ${messageType || "text"},
      ${textBody || null},
      ${status || "sent"},
      ${rawPayload ? JSON.stringify(rawPayload) : null}::jsonb,
      ${sentByUserId ? Number(sentByUserId) : null},
      ${createdAt}
    )
    ON CONFLICT DO NOTHING
  `;

  let message = null;

  if (waMessageId) {
    [message] = await sql`
      SELECT
        id,
        conversation_id,
        wa_message_id,
        direction,
        message_type,
        text_body,
        status,
        sent_by_user_id,
        created_at
      FROM whatsapp_messages
      WHERE wa_message_id = ${waMessageId}
      LIMIT 1
    `;
  }

  if (!message) {
    [message] = await sql`
      SELECT
        id,
        conversation_id,
        wa_message_id,
        direction,
        message_type,
        text_body,
        status,
        sent_by_user_id,
        created_at
      FROM whatsapp_messages
      WHERE conversation_id = ${conversation.id}
      ORDER BY id DESC
      LIMIT 1
    `;
  }

  return {
    conversationId: conversation.id,
    message,
  };
}

export async function updateMessageStatus({ waMessageId, status, rawPayload = null }) {
  if (!waMessageId) {
    return false;
  }

  const sql = getSql();
  const [message] = await sql`
    UPDATE whatsapp_messages
    SET
      status = ${status || null},
      raw_payload = COALESCE(${rawPayload ? JSON.stringify(rawPayload) : null}::jsonb, raw_payload)
    WHERE wa_message_id = ${waMessageId}
    RETURNING
      id,
      conversation_id,
      created_at
  `;

  return Boolean(message);
}

export async function listConversations({ page = 1, pageSize = 25, query = "", unreadOnly = false }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const offset = (safePage - 1) * safePageSize;
  const normalizedQuery = String(query || "").trim();
  const params = [];
  const filters = [];

  if (normalizedQuery) {
    params.push(`%${normalizedQuery}%`);
    filters.push(`(c.customer_phone ILIKE $${params.length} OR COALESCE(c.customer_name, '') ILIKE $${params.length})`);
  }

  if (unreadOnly) {
    filters.push("c.unread_count > 0");
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const sql = getSql();
  const [countRow] = await sql.query(
    `
      SELECT COUNT(*)::int AS total
      FROM whatsapp_conversations c
      ${whereClause}
    `,
    params
  );

  const listParams = [...params, safePageSize, offset];
  const rows = await sql.query(
    `
      SELECT
        c.id,
        c.customer_phone,
        c.customer_name,
        c.last_message_at,
        c.last_message_text,
        c.unread_count,
        c.assigned_user_id,
        c.created_at,
        c.updated_at,
        au.display_name AS assigned_user_name
      FROM whatsapp_conversations c
      LEFT JOIN admin_users au ON au.id = c.assigned_user_id
      ${whereClause}
      ORDER BY c.last_message_at DESC, c.id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    listParams
  );

  return {
    items: rows,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total: countRow?.total || 0,
      totalPages: Math.max(1, Math.ceil((countRow?.total || 0) / safePageSize)),
    },
  };
}

export async function getConversationDetail(conversationId) {
  const sql = getSql();
  const [conversation] = await sql`
    SELECT
      c.id,
      c.customer_phone,
      c.customer_name,
      c.last_message_at,
      c.last_message_text,
      c.unread_count,
      c.assigned_user_id,
      c.created_at,
      c.updated_at,
      au.display_name AS assigned_user_name
    FROM whatsapp_conversations c
    LEFT JOIN admin_users au ON au.id = c.assigned_user_id
    WHERE c.id = ${Number(conversationId)}
    LIMIT 1
  `;

  if (!conversation) {
    return null;
  }

  const messages = await sql`
    SELECT
      m.id,
      m.conversation_id,
      m.wa_message_id,
      m.direction,
      m.message_type,
      m.text_body,
      m.status,
      m.sent_by_user_id,
      m.created_at,
      au.display_name AS sent_by_user_name
    FROM whatsapp_messages m
    LEFT JOIN admin_users au ON au.id = m.sent_by_user_id
    WHERE m.conversation_id = ${Number(conversationId)}
    ORDER BY m.created_at ASC, m.id ASC
  `;

  return {
    conversation,
    messages,
  };
}

export async function markConversationAsRead(conversationId) {
  const sql = getSql();
  const [conversation] = await sql`
    UPDATE whatsapp_conversations
    SET
      unread_count = 0,
      updated_at = NOW()
    WHERE id = ${Number(conversationId)}
    RETURNING
      id,
      unread_count
  `;

  return conversation || null;
}

export function verifyWebhookSignature(rawBody, signatureHeader) {
  const appSecret = getEnv("WHATSAPP_APP_SECRET");

  if (!appSecret) {
    return {
      enabled: false,
      valid: true,
    };
  }

  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;

  return {
    enabled: true,
    valid: signatureHeader === expected,
  };
}

export async function processWhatsappWebhook(payload) {
  const entries = Array.isArray(payload?.entry)
    ? payload.entry
    : payload?.value && payload?.field
      ? [{ id: "direct-change", changes: [{ field: payload.field, value: payload.value }] }]
      : payload?.messages || payload?.statuses
        ? [{ id: "direct-value", changes: [{ field: "messages", value: payload }] }]
        : [];
  const summary = {
    inboundMessages: 0,
    statusUpdates: 0,
    ignored: 0,
  };

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value;
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
      const contactMap = new Map(
        contacts
          .filter((contact) => contact?.wa_id)
          .map((contact) => [
            normalizePhone(contact.wa_id),
            contact?.profile?.name || null,
          ])
      );

      for (const message of messages) {
        const phone = normalizePhone(message?.from);

        if (!phone) {
          summary.ignored += 1;
          continue;
        }

        const textBody = extractMessageText(message) || buildStatusPreview(message?.type);
        await createInboundMessage({
          phone,
          customerName: contactMap.get(phone) || null,
          messageType: message?.type || "text",
          textBody,
          waMessageId: message?.id || null,
          status: "received",
          rawPayload: message,
          occurredAt: message?.timestamp,
        });
        summary.inboundMessages += 1;
      }

      for (const statusEntry of statuses) {
        const updated = await updateMessageStatus({
          waMessageId: statusEntry?.id || null,
          status: statusEntry?.status || null,
          rawPayload: statusEntry,
        });

        if (updated) {
          summary.statusUpdates += 1;
        } else {
          summary.ignored += 1;
        }
      }

      if (!messages.length && !statuses.length) {
        summary.ignored += 1;
      }
    }
  }

  return summary;
}
