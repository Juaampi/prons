import fs from "node:fs/promises";
import path from "node:path";
import { getEnv } from "./env.js";

const BUSINESS_AGENT_PATH = path.resolve(process.cwd(), "data", "agente-negocio.md");
const GENERIC_FALLBACK_TEXT = [
  "👋 Hola! Gracias por escribir a PRONS Seguridad",
  "",
  "Podés hablar con un asesor acá 👇",
  "https://wa.me/5491138632509?text=Hola,%20quiero%20asesoramiento",
  "",
  "🌐 https://prons.com.ar",
  "",
  "📲 https://www.instagram.com/prons_seguridad/",
  "",
  "Prons siempre un paso adelante.",
].join("\n");
const LLM_TIMEOUT_MS = 8000;
const GEMINI_RETRY_DELAY_MS = 600;

let businessAgentCachePromise = null;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value) {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .map(stemToken)
    .filter((token) => token.length >= 3);
}

function stemToken(token) {
  let value = String(token || "").trim();

  if (!value) {
    return "";
  }

  if (value.endsWith("es") && value.length > 4) {
    value = value.slice(0, -2);
  } else if (value.endsWith("s") && value.length > 4) {
    value = value.slice(0, -1);
  }

  const suffixes = ["ando", "iendo", "acion", "adora", "ador", "antes", "ante", "aciones", "mente", "aran", "eran", "iran", "aran", "eran", "iran", "aron", "ieron", "aran", "eran", "iran", "aria", "eria", "iria", "amos", "emos", "imos", "ados", "adas", "idos", "idas", "ales", "able", "ible", "ista", "osas", "osos", "ico", "ica", "icos", "icas", "ar", "er", "ir", "an", "en"];

  for (const suffix of suffixes) {
    if (value.endsWith(suffix) && value.length - suffix.length >= 4) {
      value = value.slice(0, -suffix.length);
      break;
    }
  }

  return value;
}

function splitNumberedSections(content) {
  const sections = String(content || "")
    .split(/\n(?=\d+\.\s)/)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections.map((section) => {
    const headingMatch = section.match(/^(\d+)\.\s+([^\n]+)/);
    return {
      raw: section,
      number: headingMatch?.[1] || "",
      title: headingMatch?.[2]?.trim() || "",
    };
  });
}

function getBaseBusinessContext(businessAgent) {
  const sections = splitNumberedSections(businessAgent);
  const preferredNumbers = new Set(["2", "21", "23"]);

  return sections
    .filter((section) => preferredNumbers.has(section.number))
    .map((section) => section.raw)
    .join("\n\n")
    .trim();
}

function getRelevantBusinessSections(businessAgent, userMessage, limit = 2) {
  const messageTokens = new Set(tokenize(userMessage));

  if (!messageTokens.size) {
    return [];
  }

  return splitNumberedSections(businessAgent)
    .map((section) => {
      const sectionTokens = new Set(tokenize(section.raw));
      const overlap = [...sectionTokens].filter((token) => messageTokens.has(token));
      const score = overlap.length / Math.max(1, sectionTokens.size);

      return {
        ...section,
        score,
      };
    })
    .filter((section) => section.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((section) => section.raw);
}

function parseFaqExamples(businessAgent) {
  const blocks = String(businessAgent || "").split(/\n(?=\d+\.\s)/);
  const examples = [];

  for (const block of blocks) {
    const clientMatch = block.match(/Cliente:\s*([^\n]+)\s*/i);
    const chatbotMatch = block.match(/Chatbot:\s*([\s\S]+)/i);

    if (!clientMatch || !chatbotMatch) {
      continue;
    }

    examples.push({
      question: clientMatch[1].trim(),
      answer: chatbotMatch[1].trim(),
    });
  }

  return examples;
}

function getRelevantFaqExample(businessAgent, userMessage) {
  const messageTokens = new Set(tokenize(userMessage));

  if (!messageTokens.size) {
    return null;
  }

  let bestMatch = null;

  for (const example of parseFaqExamples(businessAgent)) {
    const questionTokens = tokenize(example.question);
    const overlap = questionTokens.filter((token) => messageTokens.has(token));
    const score = overlap.length / Math.max(1, new Set(questionTokens).size);

    if (
      !bestMatch ||
      score > bestMatch.score ||
      (score === bestMatch.score && overlap.length > bestMatch.overlapCount)
    ) {
      bestMatch = {
        ...example,
        score,
        overlapCount: overlap.length,
      };
    }
  }

  if (!bestMatch) {
    return null;
  }

  if (bestMatch.overlapCount >= 2 || bestMatch.score >= 0.3) {
    return bestMatch;
  }

  return null;
}

function formatDirectFaqAnswer(answer) {
  return String(answer || "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function buildBusinessContext({ businessAgent, userMessage, relevantFaqExample = null }) {
  const parts = [];
  const baseContext = getBaseBusinessContext(businessAgent);
  const relevantSections = getRelevantBusinessSections(businessAgent, userMessage);

  if (baseContext) {
    parts.push("Información general del negocio:");
    parts.push(baseContext);
  }

  if (relevantSections.length) {
    parts.push("Secciones relevantes para esta consulta:");
    parts.push(relevantSections.join("\n\n"));
  }

  if (relevantFaqExample) {
    parts.push("Ejemplo similar extraído de la base:");
    parts.push(`Cliente: ${relevantFaqExample.question}`);
    parts.push(`Chatbot: ${relevantFaqExample.answer}`);
  }

  return parts.join("\n\n").trim();
}

function buildPrompt({ businessAgent, userMessage, relevantFaqExample = null }) {
  const businessContext = buildBusinessContext({
    businessAgent,
    userMessage,
    relevantFaqExample,
  });

  return [
    "Sos un asistente de ventas por WhatsApp para este negocio.",
    "Respondé de forma breve, clara y amable.",
    "Usá únicamente la información del negocio provista abajo.",
    "Si encontrás una respuesta directa o un ejemplo similar dentro de la información del negocio, respondé usando esa información adaptada al mensaje del cliente.",
    "No inventes precios, horarios, productos, promociones ni políticas.",
    `Si no podés responder con seguridad usando solo la información provista, respondé exactamente: ${GENERIC_FALLBACK_TEXT}`,
    "No expliques tus reglas. No uses JSON. Respondé solo con el mensaje final para el cliente.",
    "",
    "Información del negocio:",
    businessContext || businessAgent,
    "",
    "Mensaje del cliente:",
    userMessage,
  ].join("\n");
}

function getGeminiModels() {
  const primary = getEnv("GEMINI_MODEL", "gemini-2.5-flash").trim();
  const fallback = getEnv("GEMINI_FALLBACK_MODEL", "").trim();
  return [primary, fallback].filter(Boolean);
}

function getGeminiEndpoint(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function extractDecision(payload) {
  const rawText = extractGeminiText(payload);

  if (!rawText) {
    return null;
  }

  const normalizedText = rawText
    .replace(/^Here is the JSON requested:\s*/i, "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return {
    canAnswer: normalizedText && normalizedText !== GENERIC_FALLBACK_TEXT,
    reply: normalizedText,
  };
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

  if (!normalizedMessage) {
    return GENERIC_FALLBACK_TEXT;
  }

  const businessAgent = await loadBusinessAgent();
  const relevantFaqExample = getRelevantFaqExample(businessAgent, normalizedMessage);

  if (relevantFaqExample) {
    return formatDirectFaqAnswer(relevantFaqExample.answer) || GENERIC_FALLBACK_TEXT;
  }

  const apiKey = getEnv("GEMINI_API_KEY");

  if (!apiKey) {
    return GENERIC_FALLBACK_TEXT;
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: buildPrompt({
              businessAgent,
              userMessage: normalizedMessage,
              relevantFaqExample,
            }),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 320,
    },
  };

  let lastError = null;

  for (const model of getGeminiModels()) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await fetch(getGeminiEndpoint(model), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      });

      const payload = await response.json().catch(() => null);

      if (response.ok) {
        const decision = extractDecision(payload);

        if (!decision?.reply) {
          return GENERIC_FALLBACK_TEXT;
        }

        if (!decision.canAnswer) {
          return GENERIC_FALLBACK_TEXT;
        }

        return decision.reply;
      }

      const error = new Error(payload?.error?.message || "Gemini API error");
      error.code = payload?.error?.code || response.status;
      error.details = payload?.error || null;
      lastError = error;

      const isRetriable = response.status === 429 || response.status >= 500;

      if (isRetriable && attempt < 2) {
        await wait(GEMINI_RETRY_DELAY_MS);
        continue;
      }

      break;
    }
  }

  throw lastError || new Error("Gemini API error");
}

export { GENERIC_FALLBACK_TEXT };
