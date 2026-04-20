import { NextResponse } from "next/server";
import { buildAiAnswer, buildTripDays, tripData, type TripDay } from "@/lib/trip";

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt?: string; selectedDay?: TripDay };
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const days = buildTripDays(tripData);
  const selectedDay = days.find((day) => day.date === body.selectedDay?.date) ?? days[0];
  const reply = buildAiAnswer(prompt, selectedDay, days, tripData);

  return NextResponse.json({
    reply,
    mode: "local-prototype",
    hint: "Replace this route with an OpenAI call when the API key is ready.",
  });
}
