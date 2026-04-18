import { getEnv } from "./env.js";

function getBasePayload({ to, templateName, bodyParameters = [] }) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: getEnv("WHATSAPP_TEMPLATE_LANG", "es_AR"),
      },
      components: bodyParameters.length
        ? [
            {
              type: "body",
              parameters: bodyParameters.map((text) => ({ type: "text", text })),
            },
          ]
        : undefined,
    },
  };
}

async function sendWhatsappTemplate(payload) {
  const token = getEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = getEnv("WHATSAPP_PHONE_NUMBER_ID");

  if (!token || !phoneNumberId) {
    console.info("WhatsApp mock mode enabled", payload);
    return { ok: true, mocked: true };
  }

  const response = await fetch(
    `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error?.message || "WhatsApp API error");
  }

  return { ok: true, mocked: false, result };
}

export async function sendNewLeadWhatsapp(client) {
  const templateName = getEnv("WHATSAPP_TEMPLATE_FORM_SUBMITTED");

  if (!templateName) {
    console.info("WhatsApp new lead template missing, using mock mode");
    return { ok: true, mocked: true };
  }

  return sendWhatsappTemplate(
    getBasePayload({
      to: client.telefono,
      templateName,
      bodyParameters: [client.nombre, client.tipo_proyecto, client.solucion],
    })
  );
}

export async function sendReminderWhatsapp(client) {
  const templateName = getEnv("WHATSAPP_TEMPLATE_REMINDER");

  if (!templateName) {
    console.info("WhatsApp reminder template missing, using mock mode");
    return { ok: true, mocked: true };
  }

  return sendWhatsappTemplate(
    getBasePayload({
      to: client.telefono,
      templateName,
      bodyParameters: [client.nombre, client.tipo_proyecto],
    })
  );
}
