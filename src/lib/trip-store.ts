import { get, list, put } from "@vercel/blob";
import { sanitizeTripData, tripData as fallbackTripData, type TripData } from "@/lib/trip";

const TRIP_DATA_PATHNAME = "trip-data/current.json";

async function readStreamText(stream: ReadableStream<Uint8Array>) {
  return await new Response(stream).text();
}

export async function loadTripData() {
  try {
    const { blobs } = await list({ prefix: TRIP_DATA_PATHNAME });
    const currentBlob = blobs.find((blob) => blob.pathname === TRIP_DATA_PATHNAME);

    if (!currentBlob) {
      return fallbackTripData;
    }

    const result = await get(currentBlob.pathname, {
      access: "private",
    });

    if (!result?.stream) {
      return fallbackTripData;
    }

    const raw = await readStreamText(result.stream);
    return sanitizeTripData(JSON.parse(raw) as TripData);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("not found")) {
      return fallbackTripData;
    }

    console.error("Failed to load trip data from blob", error);
    return fallbackTripData;
  }
}

export async function saveTripData(data: TripData) {
  const sanitized = sanitizeTripData(data);

  await put(TRIP_DATA_PATHNAME, JSON.stringify(sanitized, null, 2), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
  });

  return sanitized;
}
