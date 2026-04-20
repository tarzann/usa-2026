import { TripDashboard } from "@/components/trip-dashboard";
import { buildTripDays } from "@/lib/trip";

export default function HomePage() {
  const days = buildTripDays();

  return <TripDashboard days={days} />;
}
