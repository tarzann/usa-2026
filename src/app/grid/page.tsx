import { TripGridView } from "@/components/trip-grid-view";
import { loadTripData } from "@/lib/trip-store";

export const dynamic = "force-dynamic";

export default async function GridPage() {
  const tripData = await loadTripData();

  return <TripGridView initialTripData={tripData} />;
}
