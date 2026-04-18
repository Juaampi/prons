import { z } from "zod";
import { sanitizeEmail, sanitizeObject, sanitizePhone, sanitizeText } from "./sanitize.js";

const formSchema = z.object({
  nombre: z.string().min(2).max(120),
  email: z.email().max(160),
  telefono: z.string().min(8).max(30),
  tipoProyecto: z.string().min(2).max(120),
  solucion: z.string().min(2).max(120),
  datosExtra: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional().default({}),
  source: z.string().max(120).optional().default("formulario"),
});

const loginSchema = z.object({
  identifier: z.string().min(3).max(160),
  password: z.string().min(8).max(200),
});

export function validateClientPayload(payload) {
  const parsed = formSchema.safeParse({
    nombre: sanitizeText(payload.nombre),
    email: sanitizeEmail(payload.email),
    telefono: sanitizePhone(payload.telefono),
    tipoProyecto: sanitizeText(payload.tipoProyecto || payload.proyecto),
    solucion: sanitizeText(payload.solucion),
    datosExtra: sanitizeObject(payload.datosExtra),
    source: sanitizeText(payload.source || "formulario"),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  return { success: true, data: parsed.data };
}

export function validateLoginPayload(payload) {
  const parsed = loginSchema.safeParse({
    identifier: sanitizeText(payload.identifier),
    password: String(payload.password ?? ""),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  return { success: true, data: parsed.data };
}
