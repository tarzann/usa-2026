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
};

const defaultCenter = { lat: 34.8, lng: -78.2 };

export function RealTripMap({ apiKey, days, selectedDate }: RealTripMapProps) {
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
          <MapViewport days={days} selectedDate={selectedDate} />
          <RoutePolyline days={days} />
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
            <AdvancedMarker position={{ lat: selectedDay.location.lat, lng: selectedDay.location.lng }} title={selectedDay.title}>
              <div className="selected-map-label">
                <strong>{selectedDay.title}</strong>
                <span>{selectedDay.location.name}</span>
              </div>
            </AdvancedMarker>
          ) : null}
        </Map>
      </APIProvider>
    </div>
  );
}

function MapViewport({ days, selectedDate }: { days: TripDay[]; selectedDate: string }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !days.length || !window.google?.maps) return;

    const bounds = new window.google.maps.LatLngBounds();
    days.forEach((day) => bounds.extend({ lat: day.location.lat, lng: day.location.lng }));
    map.fitBounds(bounds, 64);

    const selectedDay = days.find((day) => day.date === selectedDate);
    if (selectedDay) {
      map.panTo({ lat: selectedDay.location.lat, lng: selectedDay.location.lng });
    }
  }, [map, days, selectedDate]);

  return null;
}

function RoutePolyline({ days }: { days: TripDay[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !window.google?.maps) return;

    const polyline = new window.google.maps.Polyline({
      path: days.map((day) => ({ lat: day.location.lat, lng: day.location.lng })),
      geodesic: true,
      strokeColor: "#0c7c74",
      strokeOpacity: 0.85,
      strokeWeight: 4,
      map,
    });

    return () => {
      polyline.setMap(null);
    };
  }, [map, days]);

  return null;
}
