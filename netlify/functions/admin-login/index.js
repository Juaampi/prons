import { createSessionCookie, createSessionToken, verifyAdminCredentials } from "../../../lib/auth.js";
import { badRequest, jsonResponse, methodNotAllowed, parseJsonBody, serverError, unauthorized } from "../../../lib/http.js";
import { validateLoginPayload } from "../../../lib/validation.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  try {
    const payload = await parseJsonBody(event);
    const validation = validateLoginPayload(payload);

    if (!validation.success) {
      return badRequest("Validation failed", validation.errors);
    }

    const isValid = await verifyAdminCredentials(
      validation.data.identifier,
      validation.data.password
    );

    if (!isValid) {
      return unauthorized("Credenciales invalidas");
    }

    const token = await createSessionToken(validation.data.identifier);

    return jsonResponse(
      200,
      { ok: true, user: { identifier: validation.data.identifier } },
      { "Set-Cookie": createSessionCookie(token) }
    );
  } catch (error) {
    return serverError(error, "No se pudo iniciar sesion");
  }
}
