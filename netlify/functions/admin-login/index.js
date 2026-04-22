import {
  createSessionCookie,
  createSessionToken,
  registerSuccessfulLogin,
  verifyAdminCredentials,
} from "../../../lib/auth.js";
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

    const user = await verifyAdminCredentials(
      validation.data.identifier,
      validation.data.password
    );

    if (!user) {
      return unauthorized("Credenciales invalidas");
    }

    await registerSuccessfulLogin(user);
    const token = await createSessionToken(user);

    return jsonResponse(
      200,
      {
        ok: true,
        user: {
          id: user.id,
          identifier: user.identifier,
          role: user.role,
          displayName: user.displayName || user.identifier,
        },
      },
      { "Set-Cookie": createSessionCookie(token) }
    );
  } catch (error) {
    return serverError(error, "No se pudo iniciar sesion");
  }
}
