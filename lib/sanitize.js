export function sanitizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizePhone(value) {
  const text = sanitizeText(value);
  return text.replace(/[^\d+]/g, "");
}

export function sanitizeEmail(value) {
  return sanitizeText(value).toLowerCase();
}

export function sanitizeObject(input = {}) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        if (value === null) {
          return [key, null];
        }

        if (Array.isArray(value)) {
          return [sanitizeText(key), value.map((item) => sanitizeText(item))];
        }

        if (typeof value === "object") {
          return [sanitizeText(key), sanitizeObject(value)];
        }

        return [sanitizeText(key), sanitizeText(value)];
      })
  );
}
