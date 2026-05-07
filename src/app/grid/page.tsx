import { TripGridView } from "@/components/trip-grid-view";
import { tripData } from "@/lib/trip";

export default function GridPage() {
  return <TripGridView initialTripData={tripData} />;
}
