import { TripDashboard } from "@/components/trip-dashboard";
import { buildTripDays } from "@/lib/trip";

export default function HomePage() {
  const days = buildTripDays();
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || "";

  return <TripDashboard days={days} googleMapsApiKey={googleMapsApiKey} />;
}
