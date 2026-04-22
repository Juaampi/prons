import bcrypt from "bcryptjs";
import { parse, serialize } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { findAdminUserByIdentifier, touchAdminUserLogin, upsertEnvAdminUser } from "./admin-users.js";
import { getEnv, getRequiredEnv, isProductionRuntime } from "./env.js";
import { unauthorized } from "./http.js";

const COOKIE_NAME = "prons_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 12;
const ALLOWED_ROLES = new Set(["admin", "seller"]);

function getSecretKey() {
  const secret = getRequiredEnv("ADMIN_SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

function getSessionIdentifier(user) {
  return user.email || user.username || "admin";
}

export async function verifyAdminCredentials(identifier, password) {
  const normalizedIdentifier = String(identifier || "").trim().toLowerCase();
  const dbUser = await findAdminUserByIdentifier(normalizedIdentifier);

  if (dbUser) {
    const passwordMatches = await bcrypt.compare(password, dbUser.passwordHash);

    if (!passwordMatches) {
      return null;
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      role: dbUser.role,
      displayName: dbUser.displayName,
      identifier: getSessionIdentifier(dbUser),
    };
  }

  const adminEmail = getEnv("ADMIN_EMAIL").toLowerCase();
  const adminUser = getEnv("ADMIN_USER").toLowerCase();
  const passwordHash = getEnv("ADMIN_PASSWORD_HASH");

  if (!passwordHash) {
    return null;
  }

  const identifierMatches =
    normalizedIdentifier === adminEmail || (adminUser && normalizedIdentifier === adminUser);

  if (!identifierMatches) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, passwordHash);

  if (!passwordMatches) {
    return null;
  }

  const envUser = await upsertEnvAdminUser({
    email: adminEmail || null,
    username: adminUser || null,
    passwordHash,
    displayName: "Administrador",
  });

  return {
    id: envUser.id,
    email: envUser.email,
    username: envUser.username,
    role: envUser.role,
    displayName: envUser.displayName,
    identifier: getSessionIdentifier(envUser),
  };
}

export async function createSessionToken(user) {
  return new SignJWT({
    sub: user.identifier,
    uid: user.id,
    role: user.role,
    name: user.displayName || user.username || user.email || user.identifier,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

export function createSessionCookie(token) {
  return serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProductionRuntime(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie() {
  return serialize(COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProductionRuntime(),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getAdminSession(event) {
  const cookieHeader = event.headers.cookie || event.headers.Cookie || "";
  const cookies = parse(cookieHeader || "");
  const token = cookies[COOKIE_NAME];

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch (error) {
    return null;
  }
}

export async function requireAdmin(event) {
  const session = await getAdminSession(event);

  if (!session || !ALLOWED_ROLES.has(session.role)) {
    return { authorized: false, response: unauthorized("Admin authentication required") };
  }

  return { authorized: true, session };
}

export async function registerSuccessfulLogin(user) {
  if (user?.id) {
    await touchAdminUserLogin(user.id);
  }
}
