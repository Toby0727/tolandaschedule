import Anthropic from "@anthropic-ai/sdk";

export async function POST(req) {
  try {
    const { base64 } = await req.json();

    if (!base64) {
      return Response.json({ error: "Missing PDF payload." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "Missing ANTHROPIC_API_KEY." }, { status: 500 });
    }

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

    const text = response.content.find((block) => block.type === "text")?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return Response.json({ data: parsed });
  } catch (err) {
    return Response.json({ error: err.message || "Extraction failed." }, { status: 500 });
  }
}
