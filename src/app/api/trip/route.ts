import { NextResponse } from "next/server";
import { saveTripData, loadTripData } from "@/lib/trip-store";
import { type TripData } from "@/lib/trip";

export async function GET() {
  const tripData = await loadTripData();

  return NextResponse.json(
    { tripData },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { tripData?: TripData };

  if (!body.tripData) {
    return NextResponse.json({ error: "tripData is required" }, { status: 400 });
  }

  try {
    const tripData = await saveTripData(body.tripData);

    return NextResponse.json(
      { tripData },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save trip data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
