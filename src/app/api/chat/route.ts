import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildImmediateUpdateReply, inferTripUpdates } from "@/lib/trip-agent";
import { buildAiAnswer, buildTripDays, sanitizeTripData, tripData, type TripData, type TripDay, type TripUpdateAction } from "@/lib/trip";

const MODEL = "gpt-5.4-mini";
type ChatHistoryItem = { role: "user" | "assistant"; body: string };

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt?: string; selectedDay?: TripDay; tripData?: TripData; history?: ChatHistoryItem[] };
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const currentTripData = body.tripData ? sanitizeTripData(body.tripData) : tripData;
  const days = buildTripDays(currentTripData);
  const selectedDay = days.find((day) => day.date === body.selectedDay?.date) ?? days[0];
  const fallbackReply = buildAiAnswer(prompt, selectedDay, days, currentTripData);
  const fallbackUpdates = inferTripUpdates(prompt, selectedDay, currentTripData);
  const recentHistory = (body.history || []).slice(-8);

  if (fallbackUpdates.length) {
    return NextResponse.json({
      reply: buildImmediateUpdateReply(fallbackUpdates),
      updates: fallbackUpdates,
      mode: "local-update",
    });
  }

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
                    type: { type: "string", enum: ["add_todo", "complete_todo", "reopen_todo", "add_event", "update_day_title", "update_day_summary", "update_event", "delete_event", "move_event", "update_flight", "update_hotel", "add_day", "remove_day"] },
                    text: { type: ["string", "null"] },
                    date: { type: ["string", "null"] },
                    label: { type: ["string", "null"] },
                    nextDate: { type: ["string", "null"] },
                    details: { type: ["string", "null"] },
                    emoji: { type: ["string", "null"] },
                    locked: { type: ["boolean", "null"] },
                    title: { type: ["string", "null"] },
                    summary: { type: ["string", "null"] },
                    nextLabel: { type: ["string", "null"] },
                    fromDate: { type: ["string", "null"] },
                    toDate: { type: ["string", "null"] },
                    booking: { type: ["string", "null"] },
                    name: { type: ["string", "null"] },
                    nextName: { type: ["string", "null"] },
                    address: { type: ["string", "null"] },
                    phone: { type: ["string", "null"] },
                    confirmation: { type: ["string", "null"] },
                    location: { type: ["string", "null"] },
                  },
                  required: ["type", "text", "date", "label", "nextDate", "details", "emoji", "locked", "title", "summary", "nextLabel", "fromDate", "toDate", "booking", "name", "nextName", "address", "phone", "confirmation", "location"],
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
        "Prefer action over discussion. If the user asked to update something and you have enough context, do it.",
        "Do not end every reply with a follow-up question. Ask a question only if you are genuinely blocked.",
        "Short confirmations like כן, אוקיי, תמשיך, or similar should be interpreted using the recent conversation context.",
        "When the user explicitly asks to change the trip, return matching updates in the updates array.",
        "Supported updates are: add_todo, complete_todo, reopen_todo, add_event, update_day_title, update_day_summary, update_event, delete_event, move_event, update_flight, update_hotel, add_day, remove_day.",
        "Only emit updates when the user clearly asked to modify data. Otherwise return an empty updates array.",
        "For add_event, default to the currently selected day unless the user clearly provided another date.",
        "For update_event and delete_event, use the exact current event label when possible.",
        "For update_flight and update_hotel, use existing labels/names from the trip context when possible.",
        "When moving a flight to another day, keep the current date in date and put the new date in nextDate.",
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
                    recentHistory,
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
        title?: string | null;
        summary?: string | null;
        nextLabel?: string | null;
        nextDate?: string | null;
        fromDate?: string | null;
        toDate?: string | null;
        booking?: string | null;
        name?: string | null;
        nextName?: string | null;
        address?: string | null;
        phone?: string | null;
        confirmation?: string | null;
        location?: string | null;
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
        case "update_day_title":
          return item.date?.trim() && item.title?.trim()
            ? [{ type: "update_day_title", date: item.date.trim(), title: item.title.trim() }]
            : [];
        case "update_day_summary":
          return item.date?.trim() && item.summary?.trim()
            ? [{ type: "update_day_summary", date: item.date.trim(), summary: item.summary.trim() }]
            : [];
        case "update_event":
          return item.date?.trim() && item.label?.trim()
            ? [{
                type: "update_event",
                date: item.date.trim(),
                label: item.label.trim(),
                nextLabel: item.nextLabel?.trim() || undefined,
                details: item.details?.trim() || undefined,
                emoji: item.emoji?.trim() || undefined,
                locked: typeof item.locked === "boolean" ? item.locked : undefined,
              }]
            : [];
        case "delete_event":
          return item.date?.trim() && item.label?.trim()
            ? [{ type: "delete_event", date: item.date.trim(), label: item.label.trim() }]
            : [];
        case "move_event":
          return item.fromDate?.trim() && item.toDate?.trim() && item.label?.trim()
            ? [{ type: "move_event", fromDate: item.fromDate.trim(), toDate: item.toDate.trim(), label: item.label.trim() }]
            : [];
        case "update_flight":
          return item.date?.trim() && item.label?.trim()
            ? [{
                type: "update_flight",
                date: item.date.trim(),
                label: item.label.trim(),
                nextDate: item.nextDate?.trim() || undefined,
                nextLabel: item.nextLabel?.trim() || undefined,
                details: item.details?.trim() || undefined,
                booking: item.booking?.trim() || undefined,
              }]
            : [];
        case "update_hotel":
          return item.name?.trim()
            ? [{
                type: "update_hotel",
                name: item.name.trim(),
                nextName: item.nextName?.trim() || undefined,
                address: item.address?.trim() || undefined,
                phone: item.phone?.trim() || undefined,
                confirmation: item.confirmation?.trim() || undefined,
                location: item.location?.trim() || undefined,
              }]
            : [];
        case "add_day":
          return item.date?.trim() ? [{ type: "add_day", date: item.date.trim() }] : [];
        case "remove_day":
          return item.date?.trim() ? [{ type: "remove_day", date: item.date.trim() }] : [];
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
