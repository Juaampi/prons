import { getSql } from "./db.js";

export async function createClientRecord(payload) {
  const sql = getSql();
  const [client] = await sql`
    INSERT INTO clients (
      nombre,
      email,
      telefono,
      tipo_proyecto,
      solucion,
      datos_extra,
      source,
      status
    ) VALUES (
      ${payload.nombre},
      ${payload.email},
      ${payload.telefono},
      ${payload.tipoProyecto},
      ${payload.solucion},
      ${JSON.stringify(payload.datosExtra || {})}::jsonb,
      ${payload.source || "formulario"},
      'nuevo'
    )
    RETURNING
      id,
      nombre,
      email,
      telefono,
      tipo_proyecto,
      solucion,
      datos_extra,
      source,
      status,
      created_at,
      updated_at
  `;

  return client;
}

export async function getClientById(clientId) {
  const sql = getSql();
  const [client] = await sql`
    SELECT
      id,
      nombre,
      email,
      telefono,
      tipo_proyecto,
      solucion,
      datos_extra,
      source,
      status,
      created_at,
      updated_at
    FROM clients
    WHERE id = ${Number(clientId)}
    LIMIT 1
  `;

  return client || null;
}

export async function listClients({ page = 1, pageSize = 10, query = "" }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 10));
  const offset = (safePage - 1) * safePageSize;
  const normalizedQuery = query.trim();
  const search = `%${normalizedQuery}%`;
  const sql = getSql();
  const filters = normalizedQuery ? "WHERE nombre ILIKE $1" : "";
  const countParams = normalizedQuery ? [search] : [];
  const listParams = normalizedQuery ? [search, safePageSize, offset] : [safePageSize, offset];

  const [countRow] = await sql.query(
    `SELECT COUNT(*)::int AS total FROM clients ${filters}`,
    countParams
  );

  const rows = await sql.query(
    `
      SELECT
        id,
        nombre,
        email,
        telefono,
        tipo_proyecto,
        solucion,
        source,
        status,
        created_at,
        updated_at
      FROM clients
      ${filters}
      ORDER BY created_at DESC
      LIMIT $${normalizedQuery ? 2 : 1}
      OFFSET $${normalizedQuery ? 3 : 2}
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
