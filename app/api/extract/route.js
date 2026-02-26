import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";

const EXTRACTION_MODELS = (
  process.env.ANTHROPIC_EXTRACT_MODELS ||
  process.env.ANTHROPIC_EXTRACT_MODEL ||
  "claude-haiku-4-5-20251001"
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const EXTRACTION_MAX_TOKENS = Number(process.env.ANTHROPIC_EXTRACT_MAX_TOKENS || 1600);
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ITEMS = 20;
const extractionCache = new Map();

const EXTRACTION_PROMPT = `Extract all time-sensitive syllabus events and return only valid JSON.
Schema:
{"course_name":string|null,"instructor":string|null,"semester":string|null,"semester_start":"YYYY-MM-DD"|null,"semester_end":"YYYY-MM-DD"|null,"events":[{"id":integer,"category":"class"|"exam"|"office_hours"|"assignment"|"project"|"other","title":string|null,"date":"YYYY-MM-DD"|null,"recurring":boolean,"recurrence_rule":string|null,"time_start":"HH:MM"|null,"time_end":"HH:MM"|null,"location":string|null,"notes":string|null}]}
Rules: use null when unknown; do not invent details; no markdown; no explanation; return one JSON object.`;

function cacheKeyFromBase64(base64) {
  return createHash("sha256").update(base64).digest("hex");
}

function getCachedExtraction(cacheKey) {
  const cached = extractionCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    extractionCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

function setCachedExtraction(cacheKey, data) {
  extractionCache.set(cacheKey, { data, timestamp: Date.now() });
  if (extractionCache.size <= CACHE_MAX_ITEMS) {
    return;
  }

  const oldestKey = extractionCache.keys().next().value;
  if (oldestKey) {
    extractionCache.delete(oldestKey);
  }
}

function stripCodeFences(text) {
  return text.replace(/```json|```/gi, "").trim();
}

function extractFirstJSONObject(text) {
  const start = text.indexOf("{");
  if (start === -1) {
    return text;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return text.slice(start);
}

function removeTrailingCommas(text) {
  return text.replace(/,\s*([}\]])/g, "$1");
}

function quoteUnquotedKeys(text) {
  return text.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3');
}

function parseModelJson(text) {
  const base = extractFirstJSONObject(stripCodeFences(text));
  const attempts = [
    base,
    removeTrailingCommas(base),
    quoteUnquotedKeys(removeTrailingCommas(base)),
  ];

  let lastError;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to parse model response as JSON.");
}

function isModelNotFoundError(error) {
  const type = error?.error?.type || error?.type || "";
  const message = error?.error?.message || error?.message || "";
  return type === "not_found_error" || /model\s*:/i.test(message);
}

export async function POST(req) {
  try {
    const { base64 } = await req.json();

    if (!base64) {
      return Response.json({ error: "Missing PDF payload." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "Missing ANTHROPIC_API_KEY." }, { status: 500 });
    }

    const cacheKey = cacheKeyFromBase64(base64);
    const cachedData = getCachedExtraction(cacheKey);
    if (cachedData) {
      return Response.json({ data: cachedData, cached: true });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let response;
    let lastError;

    for (const model of EXTRACTION_MODELS) {
      try {
        response = await client.messages.create({
          model,
          max_tokens: EXTRACTION_MAX_TOKENS,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64,
                  },
                },
                {
                  type: "text",
                  text: EXTRACTION_PROMPT,
                },
              ],
            },
          ],
        });
        break;
      } catch (error) {
        lastError = error;
        if (!isModelNotFoundError(error)) {
          throw error;
        }
      }
    }

    if (!response) {
      return Response.json(
        {
          error: `No available Anthropic model found. Tried: ${EXTRACTION_MODELS.join(", ")}. Set ANTHROPIC_EXTRACT_MODEL or ANTHROPIC_EXTRACT_MODELS to a model available in your Anthropic account.`,
          details: lastError?.message || "Model not found.",
        },
        { status: 500 }
      );
    }

    const text = response.content.find((block) => block.type === "text")?.text || "";
    const parsed = parseModelJson(text);
    setCachedExtraction(cacheKey, parsed);

    return Response.json({ data: parsed });
  } catch (err) {
    return Response.json({ error: err.message || "Extraction failed." }, { status: 500 });
  }
}
