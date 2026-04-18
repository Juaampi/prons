import bcrypt from "bcryptjs";
import { parse, serialize } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { getEnv, getRequiredEnv, isProductionRuntime } from "./env.js";
import { unauthorized } from "./http.js";

const COOKIE_NAME = "prons_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 12;

function getSecretKey() {
  const secret = getRequiredEnv("ADMIN_SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

export async function verifyAdminCredentials(identifier, password) {
  const adminEmail = getEnv("ADMIN_EMAIL").toLowerCase();
  const adminUser = getEnv("ADMIN_USER").toLowerCase();
  const passwordHash = getRequiredEnv("ADMIN_PASSWORD_HASH");
  const normalizedIdentifier = identifier.toLowerCase();

  const identifierMatches =
    normalizedIdentifier === adminEmail || (adminUser && normalizedIdentifier === adminUser);

  if (!identifierMatches) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}

export async function createSessionToken(identifier) {
  return new SignJWT({ sub: identifier, role: "admin" })
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

  if (!session || session.role !== "admin") {
    return { authorized: false, response: unauthorized("Admin authentication required") };
  }

  return { authorized: true, session };
}
