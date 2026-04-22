import { getSql } from "./db.js";

function mapAdminUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function findAdminUserByIdentifier(identifier) {
  const sql = getSql();
  const normalizedIdentifier = String(identifier || "").trim().toLowerCase();

  if (!normalizedIdentifier) {
    return null;
  }

  const [user] = await sql`
    SELECT
      id,
      email,
      username,
      password_hash,
      role,
      display_name,
      last_login_at,
      created_at,
      updated_at
    FROM admin_users
    WHERE LOWER(COALESCE(email, '')) = ${normalizedIdentifier}
      OR LOWER(COALESCE(username, '')) = ${normalizedIdentifier}
    LIMIT 1
  `;

  return mapAdminUser(user);
}

export async function upsertEnvAdminUser({ email, username, passwordHash, displayName = "Administrador" }) {
  const sql = getSql();
  const normalizedEmail = email ? email.trim().toLowerCase() : null;
  const normalizedUsername = username ? username.trim().toLowerCase() : null;
  let existingUser = null;

  if (normalizedEmail) {
    [existingUser] = await sql`
      SELECT
        id,
        email,
        username,
        password_hash,
        role,
        display_name,
        last_login_at,
        created_at,
        updated_at
      FROM admin_users
      WHERE LOWER(COALESCE(email, '')) = ${normalizedEmail}
      LIMIT 1
    `;
  }

  if (!existingUser && normalizedUsername) {
    [existingUser] = await sql`
      SELECT
        id,
        email,
        username,
        password_hash,
        role,
        display_name,
        last_login_at,
        created_at,
        updated_at
      FROM admin_users
      WHERE LOWER(COALESCE(username, '')) = ${normalizedUsername}
      LIMIT 1
    `;
  }

  if (existingUser) {
    const [updatedUser] = await sql`
      UPDATE admin_users
      SET
        email = COALESCE(${normalizedEmail}, email),
        username = COALESCE(${normalizedUsername}, username),
        password_hash = ${passwordHash},
        role = 'admin',
        display_name = COALESCE(${displayName}, display_name),
        updated_at = NOW()
      WHERE id = ${existingUser.id}
      RETURNING
        id,
        email,
        username,
        password_hash,
        role,
        display_name,
        last_login_at,
        created_at,
        updated_at
    `;

    return mapAdminUser(updatedUser);
  }

  const [createdUser] = await sql`
    INSERT INTO admin_users (
      email,
      username,
      password_hash,
      role,
      display_name
    ) VALUES (
      ${normalizedEmail},
      ${normalizedUsername},
      ${passwordHash},
      'admin',
      ${displayName}
    )
    RETURNING
      id,
      email,
      username,
      password_hash,
      role,
      display_name,
      last_login_at,
      created_at,
      updated_at
  `;

  return mapAdminUser(createdUser);
}

export async function touchAdminUserLogin(userId) {
  const sql = getSql();

  await sql`
    UPDATE admin_users
    SET
      last_login_at = NOW(),
      updated_at = NOW()
    WHERE id = ${Number(userId)}
  `;
}
