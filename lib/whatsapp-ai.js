import fs from "node:fs/promises";
import path from "node:path";
import { getEnv } from "./env.js";

const BUSINESS_AGENT_PATH = path.resolve(process.cwd(), "data", "agente-negocio.md");
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GENERIC_FALLBACK_TEXT = "Gracias por escribirnos. Un asesor te va a responder a la brevedad.";
const LLM_TIMEOUT_MS = 8000;

let businessAgentCachePromise = null;

function buildPrompt({ businessAgent, userMessage }) {
  return [
    "Sos un asistente de ventas por WhatsApp para este negocio.",
    "Respondé de forma breve, clara y amable.",
    "Usá únicamente la información del negocio provista abajo.",
    "No inventes precios, horarios, productos, promociones ni políticas.",
    "Si la respuesta no está en la información del negocio, respondé exactamente:",
    GENERIC_FALLBACK_TEXT,
    "",
    "Información del negocio:",
    businessAgent,
    "",
    "Mensaje del cliente:",
    userMessage,
  ].join("\n");
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => String(part?.text || ""))
    .join("")
    .trim();
}

export async function loadBusinessAgent() {
  if (!businessAgentCachePromise) {
    businessAgentCachePromise = fs.readFile(BUSINESS_AGENT_PATH, "utf8");
  }

  try {
    const content = await businessAgentCachePromise;
    return String(content || "").trim();
  } catch (error) {
    businessAgentCachePromise = null;
    throw error;
  }
}

export async function generateAIResponse(userMessage) {
  const normalizedMessage = String(userMessage || "").trim();
  const apiKey = getEnv("GEMINI_API_KEY");

  if (!normalizedMessage || !apiKey) {
    return GENERIC_FALLBACK_TEXT;
  }

  const businessAgent = await loadBusinessAgent();
  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildPrompt({
                businessAgent,
                userMessage: normalizedMessage,
              }),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 220,
      },
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Gemini API error");
    error.code = payload?.error?.code || response.status;
    error.details = payload?.error || null;
    throw error;
  }

  const text = extractGeminiText(payload);
  return text || GENERIC_FALLBACK_TEXT;
}

export { GENERIC_FALLBACK_TEXT };
