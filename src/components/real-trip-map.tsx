"use client";

import { useEffect } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import type { TripDay } from "@/lib/trip";

type RealTripMapProps = {
  apiKey: string;
  days: TripDay[];
  selectedDate: string;
  focusedLocation: FocusedMapLocation | null;
};

const defaultCenter = { lat: 34.8, lng: -78.2 };

export type FocusedMapLocation = {
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  route?: {
    origin: { lat: number; lng: number; label: string };
    destination: { lat: number; lng: number; label: string };
    mode: "DRIVING" | "TRANSIT" | "FLYING";
  };
};

export function RealTripMap({ apiKey, days, selectedDate, focusedLocation }: RealTripMapProps) {
  const selectedDay = days.find((day) => day.date === selectedDate) ?? days[0];

  if (!apiKey) {
    return <div className="map-frame map-loading">חסר GOOGLE_MAPS_API_KEY ולכן אי אפשר להציג את Google Maps.</div>;
  }

  return (
    <div className="map-frame real-map-frame">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={5}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId="trip-planner-map"
          className="real-map"
        >
          <MapViewport days={days} selectedDate={selectedDate} focusedLocation={focusedLocation} />
          <DrivingRoute days={days} />
          <FocusedRoute focusedLocation={focusedLocation} />
          {days.map((day) => {
            const isSelected = day.date === selectedDate;

            return (
              <AdvancedMarker
                key={day.date}
                position={{ lat: day.location.lat, lng: day.location.lng }}
                title={`${day.title} - ${day.location.name}`}
              >
                <Pin
                  background={isSelected ? "#0c7c74" : "#d56f3e"}
                  borderColor={isSelected ? "#095f59" : "#b8562a"}
                  glyphColor="#ffffff"
                  scale={isSelected ? 1.2 : 1}
                >
                  {String(day.dayNum)}
                </Pin>
              </AdvancedMarker>
            );
          })}
          {selectedDay ? (
            <AdvancedMarker
              position={{
                lat: focusedLocation?.lat ?? selectedDay.location.lat,
                lng: focusedLocation?.lng ?? selectedDay.location.lng,
              }}
              title={focusedLocation?.title ?? selectedDay.title}
            >
              <div className="selected-map-label">
                <strong>{focusedLocation?.title ?? selectedDay.title}</strong>
                <span>{focusedLocation?.subtitle ?? selectedDay.location.name}</span>
              </div>
            </AdvancedMarker>
          ) : null}
          {focusedLocation?.route ? (
            <>
              <AdvancedMarker position={focusedLocation.route.origin} title={focusedLocation.route.origin.label}>
                <Pin background="#2f2619" borderColor="#2f2619" glyphColor="#ffffff" scale={0.9}>
                  א
                </Pin>
              </AdvancedMarker>
              <AdvancedMarker position={focusedLocation.route.destination} title={focusedLocation.route.destination.label}>
                <Pin background="#0c7c74" borderColor="#095f59" glyphColor="#ffffff" scale={0.9}>
                  ב
                </Pin>
              </AdvancedMarker>
            </>
          ) : null}
        </Map>
      </APIProvider>
    </div>
  );
}

function MapViewport({
  days,
  selectedDate,
  focusedLocation,
}: {
  days: TripDay[];
  selectedDate: string;
  focusedLocation: FocusedMapLocation | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !days.length || !window.google?.maps) return;

    if (focusedLocation) {
      if (focusedLocation.route) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(focusedLocation.route.origin);
        bounds.extend(focusedLocation.route.destination);
        map.fitBounds(bounds, 96);
        return;
      }

      map.panTo({ lat: focusedLocation.lat, lng: focusedLocation.lng });
      if ((map.getZoom() ?? 0) < 13) {
        map.setZoom(13);
      }
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    days.forEach((day) => bounds.extend({ lat: day.location.lat, lng: day.location.lng }));
    map.fitBounds(bounds, 64);

    const selectedDay = days.find((day) => day.date === selectedDate);
    if (selectedDay) {
      map.panTo({ lat: selectedDay.location.lat, lng: selectedDay.location.lng });
    }
  }, [map, days, selectedDate, focusedLocation]);

  return null;
}

function FocusedRoute({ focusedLocation }: { focusedLocation: FocusedMapLocation | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !window.google?.maps || !focusedLocation?.route) return;

    const { origin, destination, mode } = focusedLocation.route;

    if (mode === "FLYING") {
      const line = new window.google.maps.Polyline({
        path: [origin, destination],
        geodesic: true,
        strokeColor: "#d56f3e",
        strokeOpacity: 0.88,
        strokeWeight: 5,
        icons: [
          {
            icon: {
              path: "M 0,-1 0,1",
              strokeOpacity: 1,
              scale: 3,
            },
            offset: "0",
            repeat: "18px",
          },
        ],
        map,
      });

      return () => {
        line.setMap(null);
      };
    }

    const service = new window.google.maps.DirectionsService();
    const renderer = new window.google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: "#d56f3e",
        strokeOpacity: 0.9,
        strokeWeight: 5,
      },
    });

    service
      .route({
        origin,
        destination,
        travelMode: mode === "TRANSIT" ? window.google.maps.TravelMode.TRANSIT : window.google.maps.TravelMode.DRIVING,
      })
      .then((result) => renderer.setDirections(result))
      .catch(() => {
        const fallback = new window.google.maps.Polyline({
          path: [origin, destination],
          geodesic: true,
          strokeColor: "#d56f3e",
          strokeOpacity: 0.72,
          strokeWeight: 4,
          map,
        });
        renderer.setMap(null);
        cleanup = () => fallback.setMap(null);
      });

    let cleanup = () => renderer.setMap(null);

    return () => {
      cleanup();
    };
  }, [map, focusedLocation]);

  return null;
}

function DrivingRoute({ days }: { days: TripDay[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !window.google?.maps || days.length < 2) return;

    const service = new window.google.maps.DirectionsService();
    const renderer = new window.google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: "#0c7c74",
        strokeOpacity: 0.82,
        strokeWeight: 5,
      },
    });

    const origin = { lat: days[0].location.lat, lng: days[0].location.lng };
    const destination = {
      lat: days[days.length - 1].location.lat,
      lng: days[days.length - 1].location.lng,
    };

    const rawWaypoints = days.slice(1, -1).map((day) => ({
      location: { lat: day.location.lat, lng: day.location.lng },
      stopover: true,
    }));

    const waypointGroups = splitWaypoints(rawWaypoints, 23);

    let active = true;

    async function loadRoute() {
      const mergedPath: google.maps.LatLngLiteral[] = [];
      let segmentOrigin = origin;

      for (let index = 0; index < waypointGroups.length || index === 0; index += 1) {
        const group = waypointGroups[index] ?? [];
        const segmentDestination =
          index === waypointGroups.length - 1 || waypointGroups.length === 0
            ? destination
            : (group[group.length - 1]?.location as google.maps.LatLngLiteral);
        const segmentWaypoints =
          index === waypointGroups.length - 1 || waypointGroups.length === 0
            ? group
            : group.slice(0, -1);

        const result = await service.route({
          origin: segmentOrigin,
          destination: segmentDestination,
          waypoints: segmentWaypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
        });

        const route = result.routes[0];
        const overviewPath = route?.overview_path?.map((point) => ({
          lat: point.lat(),
          lng: point.lng(),
        })) ?? [];

        if (index === 0) {
          mergedPath.push(...overviewPath);
        } else {
          mergedPath.push(...overviewPath.slice(1));
        }

        segmentOrigin = segmentDestination;
      }

      if (!active || !mergedPath.length) return;

      const routePath = new window.google.maps.Polyline({
        path: mergedPath,
        geodesic: true,
        strokeColor: "#0c7c74",
        strokeOpacity: 0.82,
        strokeWeight: 5,
        map,
      });

      renderer.setMap(null);

      cleanup = () => {
        routePath.setMap(null);
      };
    }

    let cleanup = () => {
      renderer.setMap(null);
    };

    loadRoute().catch(() => {
      const fallbackLine = new window.google.maps.Polyline({
        path: days.map((day) => ({ lat: day.location.lat, lng: day.location.lng })),
        geodesic: true,
        strokeColor: "#0c7c74",
        strokeOpacity: 0.65,
        strokeWeight: 4,
        map,
      });

      cleanup = () => {
        fallbackLine.setMap(null);
      };
    });

    return () => {
      active = false;
      cleanup();
    };
  }, [map, days]);

  return null;
}

function splitWaypoints<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
