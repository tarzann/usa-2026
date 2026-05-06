import { TripDashboard } from "@/components/trip-dashboard";
import { buildTripDays, tripData } from "@/lib/trip";

export default function HomePage() {
  const days = buildTripDays();
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || "";

  return <TripDashboard days={days} initialTripData={tripData} googleMapsApiKey={googleMapsApiKey} />;
}
