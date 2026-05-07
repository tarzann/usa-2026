import { get, list, put } from "@vercel/blob";
import { sanitizeTripData, tripData as fallbackTripData, type TripData } from "@/lib/trip";

const TRIP_DATA_PATHNAME = "trip-data/current.json";

async function readStreamText(stream: ReadableStream<Uint8Array>) {
  return await new Response(stream).text();
}

async function readTripDataBlob() {
  const { blobs } = await list({ prefix: TRIP_DATA_PATHNAME });
  const currentBlob = blobs.find((blob) => blob.pathname === TRIP_DATA_PATHNAME);

  if (!currentBlob) {
    return null;
  }

  const result = await get(currentBlob.pathname, {
    access: "private",
  });

  if (!result?.stream) {
    return null;
  }

  const raw = await readStreamText(result.stream);
  return sanitizeTripData(JSON.parse(raw) as TripData);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loadTripData() {
  try {
    const currentTripData = await readTripDataBlob();
    return currentTripData ?? fallbackTripData;
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
  const expected = JSON.stringify(sanitized);

  await put(TRIP_DATA_PATHNAME, JSON.stringify(sanitized, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
  });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const currentTripData = await readTripDataBlob().catch(() => null);
    if (currentTripData && JSON.stringify(currentTripData) === expected) {
      return currentTripData;
    }

    await sleep(150 * (attempt + 1));
  }

  return sanitized;
}
