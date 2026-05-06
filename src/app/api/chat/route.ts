import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildAiAnswer, buildTripDays, formatDate, sanitizeTripData, tripData, type TripData, type TripDay, type TripUpdateAction } from "@/lib/trip";

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
                    type: { type: "string", enum: ["add_todo", "complete_todo", "reopen_todo", "add_event", "update_day_title", "update_day_summary", "update_event", "delete_event", "move_event", "update_flight", "update_hotel"] },
                    text: { type: ["string", "null"] },
                    date: { type: ["string", "null"] },
                    label: { type: ["string", "null"] },
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
                  required: ["type", "text", "date", "label", "details", "emoji", "locked", "title", "summary", "nextLabel", "fromDate", "toDate", "booking", "name", "nextName", "address", "phone", "confirmation", "location"],
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
        "Supported updates are: add_todo, complete_todo, reopen_todo, add_event, update_day_title, update_day_summary, update_event, delete_event, move_event, update_flight, update_hotel.",
        "Only emit updates when the user clearly asked to modify data. Otherwise return an empty updates array.",
        "For add_event, default to the currently selected day unless the user clearly provided another date.",
        "For update_event and delete_event, use the exact current event label when possible.",
        "For update_flight and update_hotel, use existing labels/names from the trip context when possible.",
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
        title?: string | null;
        summary?: string | null;
        nextLabel?: string | null;
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

  if ((normalized.includes("שנה") || normalized.includes("עדכן")) && normalized.includes("כותרת")) {
    const title = quoted || text.split(":")[1]?.trim();
    return title ? [{ type: "update_day_title", date: selectedDay.date, title }] : [];
  }

  if ((normalized.includes("שנה") || normalized.includes("עדכן")) && (normalized.includes("סיכום") || normalized.includes("תיאור היום"))) {
    const summary = quoted || text.split(":")[1]?.trim();
    return summary ? [{ type: "update_day_summary", date: selectedDay.date, summary }] : [];
  }

  if ((normalized.includes("מחק") || normalized.includes("delete")) && normalized.includes("אירוע")) {
    const label = quoted || findMatchingEventLabel(text, selectedDay.events.map((event) => event.label));
    return label ? [{ type: "delete_event", date: selectedDay.date, label }] : [];
  }

  if ((normalized.includes("העבר") || normalized.includes("move")) && normalized.includes("אירוע")) {
    const label = quoted || findMatchingEventLabel(text, selectedDay.events.map((event) => event.label));
    if (!label) return [];

    if (normalized.includes("למחר") || normalized.includes("to tomorrow")) {
      const days = buildTripDays(currentTripData);
      const currentDayIndex = days.find((day) => day.date === selectedDay.date)?.index;
      const nextDay = typeof currentDayIndex === "number" ? days[currentDayIndex + 1] : null;
      return nextDay ? [{ type: "move_event", fromDate: selectedDay.date, toDate: nextDay.date, label }] : [];
    }

    const explicitDate = text.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0];
    return explicitDate ? [{ type: "move_event", fromDate: selectedDay.date, toDate: explicitDate, label }] : [];
  }

  if ((normalized.includes("עדכן") || normalized.includes("שנה")) && normalized.includes("אירוע")) {
    const label = quoted || findMatchingEventLabel(text, selectedDay.events.map((event) => event.label));
    const details = text.split(":")[1]?.trim();
    return label && details
      ? [{ type: "update_event", date: selectedDay.date, label, details }]
      : [];
  }

  if ((normalized.includes("עדכן") || normalized.includes("שנה")) && (normalized.includes("טיסה") || normalized.includes("flight"))) {
    const label = quoted || findMatchingFlightLabel(text, currentTripData.flights.map((flight) => flight.label));
    const details = text.split(":")[1]?.trim();
    const flight = label ? currentTripData.flights.find((item) => item.label === label) : null;
    return label && details
      ? [{ type: "update_flight", date: flight?.date || selectedDay.date, label, details }]
      : [];
  }

  if ((normalized.includes("עדכן") || normalized.includes("שנה")) && (normalized.includes("מלון") || normalized.includes("לינה") || normalized.includes("hotel"))) {
    const hotelName = quoted || findMatchingHotelName(text, currentTripData.hotels.map((hotel) => hotel.name));
    const details = text.split(":")[1]?.trim();
    if (!hotelName || !details) return [];

    return [{
      type: "update_hotel",
      name: hotelName,
      address: details,
    }];
  }

  return [];
}

function findMatchingTodoText(prompt: string, todos: string[]) {
  const normalizedPrompt = prompt.toLowerCase();
  return todos.find((todo) => normalizedPrompt.includes(todo.toLowerCase()));
}

function findMatchingEventLabel(prompt: string, events: string[]) {
  const normalizedPrompt = prompt.toLowerCase();
  return events.find((event) => normalizedPrompt.includes(event.toLowerCase()));
}

function findMatchingFlightLabel(prompt: string, flights: string[]) {
  const normalizedPrompt = prompt.toLowerCase();
  return flights.find((flight) => normalizedPrompt.includes(flight.toLowerCase()));
}

function findMatchingHotelName(prompt: string, hotels: string[]) {
  const normalizedPrompt = prompt.toLowerCase();
  return hotels.find((hotel) => normalizedPrompt.includes(hotel.toLowerCase()));
}

function buildImmediateUpdateReply(updates: TripUpdateAction[]) {
  const lines = updates.map((update) => {
    switch (update.type) {
      case "add_todo":
        return `הוספתי משימה חדשה: ${update.text}`;
      case "complete_todo":
        return `סימנתי את המשימה כבוצעה: ${update.text}`;
      case "reopen_todo":
        return `פתחתי מחדש את המשימה: ${update.text}`;
      case "add_event":
        return `הוספתי אירוע ל-${formatDate(update.date)}: ${update.label}`;
      case "update_day_title":
        return `עדכנתי את כותרת היום של ${formatDate(update.date)} ל-"${update.title}".`;
      case "update_day_summary":
        return `עדכנתי את סיכום היום של ${formatDate(update.date)}.`;
      case "update_event":
        return `עדכנתי את האירוע "${update.label}" ביום ${formatDate(update.date)}.`;
      case "delete_event":
        return `מחקתי את האירוע "${update.label}" מ-${formatDate(update.date)}.`;
      case "move_event":
        return `העברתי את האירוע "${update.label}" מ-${formatDate(update.fromDate)} ל-${formatDate(update.toDate)}.`;
      case "update_flight":
        return `עדכנתי את פרטי הטיסה "${update.label}" ליום ${formatDate(update.date)}.`;
      case "update_hotel":
        return `עדכנתי את פרטי הלינה "${update.name}".`;
      default:
        return "בוצע עדכון במסלול.";
    }
  });

  return `${lines.join("\n")}\n\nהנתונים במסך עודכנו מקומית עכשיו. אם תרצה, אפשר להמשיך ולעדכן עוד פרטים לאותו יום.`;
}
