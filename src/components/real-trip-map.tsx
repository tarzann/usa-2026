"use client";

import { useEffect } from "react";
import type { LatLngExpression, LatLngTuple } from "leaflet";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { TripDay } from "@/lib/trip";

type RealTripMapProps = {
  days: TripDay[];
  selectedDate: string;
};

const defaultCenter: LatLngTuple = [34.8, -78.2];

export function RealTripMap({ days, selectedDate }: RealTripMapProps) {
  const points = days.map((day) => [day.location.lat, day.location.lng] as LatLngTuple);
  const selectedDay = days.find((day) => day.date === selectedDate) ?? days[0];

  return (
    <div className="map-frame real-map-frame">
      <MapContainer
        center={defaultCenter}
        zoom={5}
        scrollWheelZoom
        className="real-map"
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport points={points} selected={selectedDay ? [selectedDay.location.lat, selectedDay.location.lng] : null} />
        <Polyline positions={points} pathOptions={{ color: "#0c7c74", weight: 4, opacity: 0.72 }} />
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          const position: LatLngExpression = [day.location.lat, day.location.lng];
          return (
            <Marker key={day.date} position={position} icon={buildMarkerIcon(day.dayNum, isSelected)}>
              <Popup>
                <strong>{day.title}</strong>
                <br />
                {day.location.name}
                <br />
                {day.summary}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function MapViewport({ points, selected }: { points: LatLngTuple[]; selected: LatLngTuple | null }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.2), { animate: true });

    if (selected) {
      map.panTo(selected, { animate: true });
    }
  }, [map, points, selected]);

  return null;
}

function buildMarkerIcon(dayNum: number, isSelected: boolean) {
  return L.divIcon({
    className: "trip-map-marker-wrapper",
    html: `
      <div class="trip-map-marker ${isSelected ? "selected" : ""}">
        <span>${dayNum}</span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -14],
  });
}
