import { Resend } from "resend";
import { getEnv, getSiteUrl } from "./env.js";

function getEmailTheme() {
  return {
    bg: "#f5f8fc",
    surface: "#ffffff",
    line: "#dce7f4",
    text: "#10233c",
    muted: "#60748f",
    blue: "#2c7de3",
    blueDeep: "#193d76",
    accent: "#ffd056",
  };
}

function buildEmailHtml({ heading, intro, client, ctaLabel, ctaHref }) {
  const theme = getEmailTheme();
  const summaryRows = [
    ["Tipo de proyecto", client.tipo_proyecto],
    ["Solucion solicitada", client.solucion],
    ["Contacto", `${client.nombre} | ${client.telefono}`],
  ];

  const summaryHtml = summaryRows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 10px 0; color: ${theme.muted}; font-size: 14px;">${label}</td>
          <td style="padding: 10px 0; color: ${theme.text}; font-size: 14px; font-weight: 700; text-align: right;">${value}</td>
        </tr>
      `
    )
    .join("");

  const valueCards = [
    {
      title: "Analisis del proyecto",
      text: "Revisamos el tipo de espacio, uso diario, riesgos y necesidades operativas antes de definir una propuesta.",
    },
    {
      title: "Solucion a medida",
      text: "Combinamos CCTV, intrusion, incendios, accesos o videoporteria segun el alcance real del proyecto.",
    },
    {
      title: "Implementacion profesional",
      text: "Priorizamos una instalacion prolija, escalable y facil de operar desde el primer dia.",
    },
  ]
    .map(
      (card) => `
        <td style="width: 33.33%; vertical-align: top; padding: 0 6px 12px;">
          <div style="height: 100%; padding: 18px; border: 1px solid ${theme.line}; border-radius: 22px; background: #f8fbff;">
            <p style="margin: 0 0 8px; color: ${theme.blueDeep}; font-size: 14px; font-weight: 800;">${card.title}</p>
            <p style="margin: 0; color: ${theme.muted}; font-size: 13px; line-height: 1.7;">${card.text}</p>
          </div>
        </td>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${heading}</title>
      </head>
      <body style="margin: 0; padding: 24px 0; background: ${theme.bg}; font-family: Inter, Arial, sans-serif; color: ${theme.text};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 0 16px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, ${theme.blueDeep}, ${theme.blue}); border-radius: 28px 28px 0 0;">
                      <tr>
                        <td style="padding: 36px 32px 30px;">
                          <div style="display: inline-block; margin-bottom: 14px; color: #cfe3ff; font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;">
                            Prons Seguridad
                          </div>
                          <h1 style="margin: 0; color: #ffffff; font-family: Outfit, Arial, sans-serif; font-size: 34px; line-height: 1.06;">
                            ${heading}
                          </h1>
                          <p style="margin: 16px 0 0; color: rgba(255,255,255,0.88); font-size: 16px; line-height: 1.7;">
                            ${intro}
                          </p>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${theme.surface}; border: 1px solid ${theme.line}; border-top: 0; border-radius: 0 0 28px 28px; overflow: hidden;">
                      <tr>
                        <td style="padding: 30px 32px 14px;">
                          <p style="margin: 0 0 18px; color: ${theme.text}; font-size: 16px; line-height: 1.75;">
                            Recibimos tu consulta y ya la dejamos en revision comercial. Nuestro equipo va a analizar el alcance tecnico para proponerte una solucion clara, escalable y bien ejecutada.
                          </p>
                          <p style="margin: 0 0 24px; color: ${theme.muted}; font-size: 15px; line-height: 1.75;">
                            Trabajamos en proyectos para empresas, edificios, obras y desarrollos donde la seguridad, la prolijidad de instalacion y la continuidad operativa son prioridad. El objetivo no es solo instalar equipos, sino ordenar una solucion que funcione bien en el uso real del espacio.
                          </p>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 26px;">
                            ${summaryHtml}
                          </table>
                          <div style="margin-bottom: 26px; padding: 22px 24px; border-radius: 24px; background: linear-gradient(180deg, rgba(25, 61, 118, 0.04), rgba(44, 125, 227, 0.08));">
                            <p style="margin: 0 0 10px; color: ${theme.blueDeep}; font-size: 15px; font-weight: 800;">
                              Que tipo de soluciones desarrollamos
                            </p>
                            <p style="margin: 0; color: ${theme.muted}; font-size: 14px; line-height: 1.8;">
                              Videovigilancia, control de acceso, intrusion, deteccion de incendio, videoporteria y sistemas integrados pensados para brindar mas control, mas trazabilidad y una operacion simple para el usuario final.
                            </p>
                          </div>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin: 0 -6px 20px;">
                            <tr>
                              ${valueCards}
                            </tr>
                          </table>
                          <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 26px;">
                            <tr>
                              <td style="border-radius: 999px; background: linear-gradient(135deg, ${theme.blue}, #4f9cf2);">
                                <a href="${ctaHref}" style="display: inline-block; padding: 15px 22px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">
                                  ${ctaLabel}
                                </a>
                              </td>
                            </tr>
                          </table>
                          <div style="padding: 20px 22px; background: #eef5fc; border-radius: 22px;">
                            <p style="margin: 0 0 8px; color: ${theme.blueDeep}; font-size: 14px; font-weight: 800;">
                              Como sigue el proceso
                            </p>
                            <p style="margin: 0; color: ${theme.muted}; font-size: 14px; line-height: 1.7;">
                              1. Revisamos el tipo de proyecto y el objetivo de seguridad. 2. Definimos la combinacion de sistemas recomendada. 3. Te contactamos con una propuesta alineada al uso real, la instalacion y la futura operacion.
                            </p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 32px 30px;">
                          <p style="margin: 18px 0 0; color: ${theme.muted}; font-size: 13px; line-height: 1.7;">
                            Si queres adelantar informacion, podes responder este correo o escribirnos por WhatsApp con fotos, planos, referencias del proyecto o necesidades puntuales.
                          </p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 18px 0 0; padding: 0 6px; color: ${theme.muted}; font-size: 12px; line-height: 1.6; text-align: center;">
                      Prons Seguridad | CCTV, incendios, accesos, intrusion y videoporteria.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export async function sendEmail({ to, subject, html, tags = [] }) {
  const apiKey = getEnv("RESEND_API_KEY");
  const from = getEnv("EMAIL_FROM");

  if (!apiKey || !from) {
    console.info("Email mock mode enabled", { to, subject, tags });
    return { ok: true, mocked: true };
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to,
    subject,
    html,
    tags,
  });

  if (result?.error) {
    throw new Error(result.error.message || "Resend API error");
  }

  return { ok: true, mocked: false, result };
}

export async function sendNewLeadEmail(client) {
  const siteUrl = getSiteUrl();
  const html = buildEmailHtml({
    heading: "Recibimos tu consulta",
    intro:
      "Gracias por contactarte con Prons Seguridad. Ya registramos tu solicitud y en breve un asesor comercial va a escribirte con una propuesta alineada a tu proyecto.",
    client,
    ctaLabel: "Ver formulario completado",
    ctaHref: `${siteUrl}/formulario`,
  });

  return sendEmail({
    to: client.email,
    subject: "Prons Seguridad | Recibimos tu consulta",
    html,
    tags: [{ name: "flow", value: "new-lead" }],
  });
}

export async function sendReminderEmail(client) {
  const html = buildEmailHtml({
    heading: "Seguimos con tu proyecto",
    intro:
      "Te escribimos para retomar la consulta que nos compartiste y ayudarte a avanzar con una propuesta tecnica y comercial clara.",
    client,
    ctaLabel: "Hablar con un asesor",
    ctaHref: "https://wa.me/5491166200303",
  });

  return sendEmail({
    to: client.email,
    subject: "Prons Seguridad | Recordatorio de asesoramiento",
    html,
    tags: [{ name: "flow", value: "reminder" }],
  });
}
