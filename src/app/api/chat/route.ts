import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildAiAnswer, buildTripDays, tripData, type TripDay } from "@/lib/trip";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt?: string; selectedDay?: TripDay };
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const days = buildTripDays(tripData);
  const selectedDay = days.find((day) => day.date === body.selectedDay?.date) ?? days[0];
  const fallbackReply = buildAiAnswer(prompt, selectedDay, days, tripData);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY is missing on the server",
        reply: fallbackReply,
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
      text: { verbosity: "medium" },
      instructions: [
        "You are Trip AI, a smart travel planner embedded inside a trip dashboard.",
        "Answer in Hebrew unless the user explicitly asks for another language.",
        "Use only the provided trip data as the source of truth. If information is missing, say so clearly and suggest the best next action.",
        "Be practical, concise, and product-minded. Focus on itinerary quality, logistics, booking gaps, timing, and smart recommendations.",
        "When useful, structure the answer into short sections or bullets, but keep it easy to scan in chat.",
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
                      title: tripData.title,
                      participants: tripData.participants,
                      startDate: tripData.startDate,
                      endDate: tripData.endDate,
                    },
                    selectedDay,
                    nextDay,
                    openTodos: tripData.todos.filter((todo) => !todo.done).slice(0, 8),
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

    return NextResponse.json({
      reply: response.output_text?.trim() || fallbackReply,
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
        mode: "local-fallback",
      },
      { status: 502 },
    );
  }
}
