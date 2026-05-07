import { TripDashboard } from "@/components/trip-dashboard";
import { buildTripDays } from "@/lib/trip";
import { loadTripData } from "@/lib/trip-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const tripData = await loadTripData();
  const days = buildTripDays(tripData);
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || "";

  return <TripDashboard days={days} initialTripData={tripData} googleMapsApiKey={googleMapsApiKey} />;
}
