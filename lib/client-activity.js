import { getSql } from "./db.js";

function getActorName(session, fallback = "Sistema") {
  return session?.name || session?.displayName || session?.sub || fallback;
}

function mapActivity(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    actionType: row.action_type,
    message: row.message,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

export async function createClientActivityLog({
  clientId,
  actionType,
  message,
  metadata = {},
  actorSession = null,
  actorName = null,
  actorRole = null,
}) {
  const sql = getSql();
  const [row] = await sql`
    INSERT INTO client_activity_logs (
      client_id,
      actor_user_id,
      actor_name,
      actor_role,
      action_type,
      message,
      metadata
    ) VALUES (
      ${Number(clientId)},
      ${actorSession?.uid ? Number(actorSession.uid) : null},
      ${actorName || getActorName(actorSession)},
      ${actorRole || actorSession?.role || null},
      ${actionType},
      ${message},
      ${JSON.stringify(metadata || {})}::jsonb
    )
    RETURNING
      id,
      client_id,
      actor_user_id,
      actor_name,
      actor_role,
      action_type,
      message,
      metadata,
      created_at
  `;

  return mapActivity(row);
}

export async function listClientActivityLogs(clientId, limit = 20) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      client_id,
      actor_user_id,
      actor_name,
      actor_role,
      action_type,
      message,
      metadata,
      created_at
    FROM client_activity_logs
    WHERE client_id = ${Number(clientId)}
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, Math.min(50, Number(limit) || 20))}
  `;

  return rows.map(mapActivity);
}
