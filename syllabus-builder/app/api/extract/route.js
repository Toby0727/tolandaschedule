import Anthropic from "@anthropic-ai/sdk";

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

export async function POST(req) {
  try {
    const { base64 } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
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
              text: `You are an academic schedule extraction assistant. Extract ALL time-sensitive events from this syllabus and return ONLY valid JSON — no markdown, no backticks, no explanation. Use this exact schema:
{
  "course_name": string,
  "instructor": string,
  "semester": string,
  "semester_start": "YYYY-MM-DD",
  "semester_end": "YYYY-MM-DD",
  "events": [
    {
      "id": integer,
      "category": "class" | "exam" | "office_hours" | "assignment" | "project" | "other",
      "title": string,
      "date": "YYYY-MM-DD" or null if recurring,
      "recurring": boolean,
      "recurrence_rule": string or null,
      "time_start": "HH:MM" or null,
      "time_end": "HH:MM" or null,
      "location": string or null,
      "notes": string or null
    }
  ]
}
If any field is missing from the syllabus use null. Do not invent information. Return ONLY the JSON object.`,
            },
          ],
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text || "";
    const parsed = parseModelJson(text);

    return Response.json({ data: parsed });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
