import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildAiAnswer, buildTripDays, sanitizeTripData, tripData, type TripData, type TripDay, type TripUpdateAction } from "@/lib/trip";

const MODEL = "gpt-5.4-mini";

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt?: string; selectedDay?: TripDay; tripData?: TripData };
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const currentTripData = body.tripData ? sanitizeTripData(body.tripData) : tripData;
  const days = buildTripDays(currentTripData);
  const selectedDay = days.find((day) => day.date === body.selectedDay?.date) ?? days[0];
  const fallbackReply = buildAiAnswer(prompt, selectedDay, days, currentTripData);
  const fallbackUpdates = inferTripUpdates(prompt, selectedDay, currentTripData);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY is missing on the server",
        reply: fallbackReply,
        updates: fallbackUpdates,
        mode: "local-fallback",
      },
      { status: 503 },
    );
  }

  const nextDay = days[selectedDay.index + 1] ?? null;
  const client = new OpenAI({ apiKey });

  try {
    const response = await client.responses.create({
      model: MODEL,
      reasoning: { effort: "none" },
      text: {
        verbosity: "medium",
        format: {
          type: "json_schema",
          name: "trip_agent_result",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              reply: { type: "string" },
              updates: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    type: { type: "string", enum: ["add_todo", "complete_todo", "reopen_todo", "add_event"] },
                    text: { type: ["string", "null"] },
                    date: { type: ["string", "null"] },
                    label: { type: ["string", "null"] },
                    details: { type: ["string", "null"] },
                    emoji: { type: ["string", "null"] },
                    locked: { type: ["boolean", "null"] },
                  },
                  required: ["type", "text", "date", "label", "details", "emoji", "locked"],
                },
              },
            },
            required: ["reply", "updates"],
          },
        },
      },
      instructions: [
        "You are Trip AI, a smart travel planner embedded inside a trip dashboard.",
        "Answer in Hebrew unless the user explicitly asks for another language.",
        "Use only the provided trip data as the source of truth. If information is missing, say so clearly and suggest the best next action.",
        "Be practical, concise, and product-minded. Focus on itinerary quality, logistics, booking gaps, timing, and smart recommendations.",
        "When useful, structure the answer into short sections or bullets, but keep it easy to scan in chat.",
        "When the user explicitly asks to change the trip, return matching updates in the updates array.",
        "Supported updates are: add_todo, complete_todo, reopen_todo, add_event.",
        "Only emit updates when the user clearly asked to modify data. Otherwise return an empty updates array.",
        "For add_event, default to the currently selected day unless the user clearly provided another date.",
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `User request: ${prompt}`,
                "",
                "Trip context:",
                JSON.stringify(
                  {
                    trip: {
                      title: currentTripData.title,
                      participants: currentTripData.participants,
                      startDate: currentTripData.startDate,
                      endDate: currentTripData.endDate,
                    },
                    selectedDay,
                    nextDay,
                    openTodos: currentTripData.todos.filter((todo) => !todo.done).slice(0, 8),
                  },
                  null,
                  2,
                ),
              ].join("\n"),
            },
          ],
        },
      ],
    });
    const parsed = parseAgentResponse(response.output_text || "");

    return NextResponse.json({
      reply: parsed.reply || fallbackReply,
      updates: parsed.updates.length ? parsed.updates : fallbackUpdates,
      mode: "openai",
      model: MODEL,
      requestId: response._request_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OpenAI error";

    return NextResponse.json(
      {
        error: message,
        reply: fallbackReply,
        updates: fallbackUpdates,
        mode: "local-fallback",
      },
      { status: 502 },
    );
  }
}

function parseAgentResponse(raw: string): { reply: string; updates: TripUpdateAction[] } {
  try {
    const parsed = JSON.parse(raw) as {
      reply?: string;
      updates?: Array<{
        type?: string;
        text?: string | null;
        date?: string | null;
        label?: string | null;
        details?: string | null;
        emoji?: string | null;
        locked?: boolean | null;
      }>;
    };

    const updates = (parsed.updates || []).flatMap((item): TripUpdateAction[] => {
      switch (item.type) {
        case "add_todo":
        case "complete_todo":
        case "reopen_todo":
          return item.text?.trim() ? [{ type: item.type, text: item.text.trim() }] : [];
        case "add_event":
          return item.date?.trim() && item.label?.trim() && item.details?.trim()
            ? [{
                type: "add_event",
                date: item.date.trim(),
                label: item.label.trim(),
                details: item.details.trim(),
                emoji: item.emoji?.trim() || undefined,
                locked: item.locked ?? undefined,
              }]
            : [];
        default:
          return [];
      }
    });

    return {
      reply: parsed.reply?.trim() || "",
      updates,
    };
  } catch {
    return { reply: raw.trim(), updates: [] };
  }
}

function inferTripUpdates(prompt: string, selectedDay: TripDay, currentTripData: TripData): TripUpdateAction[] {
  const text = prompt.trim();
  const normalized = text.toLowerCase();
  const quoted = text.match(/["“](.+?)["”]/)?.[1]?.trim() || text.match(/'(.+?)'/)?.[1]?.trim();

  if ((normalized.includes("הוסף") || normalized.includes("תוסיף") || normalized.includes("add")) && (normalized.includes("משימה") || normalized.includes("todo"))) {
    const todoText = quoted || text.split(":")[1]?.trim() || text.replace(/.*(?:משימה|todo)\s*/i, "").trim();
    return todoText ? [{ type: "add_todo", text: todoText }] : [];
  }

  if ((normalized.includes("סמן") || normalized.includes("תסמן") || normalized.includes("mark")) && (normalized.includes("בוצע") || normalized.includes("done") || normalized.includes("הושלם"))) {
    const todoText = quoted || findMatchingTodoText(text, currentTripData.todos.map((todo) => todo.text));
    return todoText ? [{ type: "complete_todo", text: todoText }] : [];
  }

  if ((normalized.includes("פתח") || normalized.includes("החזר") || normalized.includes("reopen")) && normalized.includes("משימ")) {
    const todoText = quoted || findMatchingTodoText(text, currentTripData.todos.map((todo) => todo.text));
    return todoText ? [{ type: "reopen_todo", text: todoText }] : [];
  }

  if ((normalized.includes("הוסף") || normalized.includes("תוסיף") || normalized.includes("add")) && (normalized.includes("אירוע") || normalized.includes("activity") || normalized.includes("אטרקציה"))) {
    const label = quoted || text.split(":")[1]?.trim();
    return label
      ? [{
          type: "add_event",
          date: selectedDay.date,
          label,
          details: `נוסף דרך Trip AI: ${label}`,
          emoji: "📍",
        }]
      : [];
  }

  return [];
}

function findMatchingTodoText(prompt: string, todos: string[]) {
  const normalizedPrompt = prompt.toLowerCase();
  return todos.find((todo) => normalizedPrompt.includes(todo.toLowerCase()));
}
