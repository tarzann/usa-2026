"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  applyTripUpdates,
  buildTripDays,
  type DestinationHero,
  formatDate,
  sanitizeTripData,
  type DayCar,
  type Flight,
  type Hotel,
  type TripResource,
  type TripData,
  type TripDay,
  type TripUpdateAction,
  type UploadedAsset,
} from "@/lib/trip";
import { type DayAttachment } from "@/lib/attachments";

type TripGridViewProps = {
  initialTripData: TripData;
};

type DayLocationForm = {
  name: string;
  region: string;
  lat: string;
  lng: string;
};

type DayCarForm = {
  startDate: string;
  endDate: string;
  provider: string;
  pickup: string;
  dropoff: string;
  confirmation: string;
  notes: string;
};

type DayFlightForm = {
  label: string;
  airline: string;
  from: string;
  stops: string;
  to: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  confirmation: string;
};

type DayHotelForm = {
  name: string;
  location: string;
  address: string;
  phone: string;
  confirmation: string;
  checkIn: string;
  checkOut: string;
};

type TripResourceForm = {
  title: string;
  content: string;
  url: string;
  file: TripResource["file"] | null;
};

type DestinationHeroForm = {
  locationName: string;
  url: string;
  file: UploadedAsset | null;
};

type GridEditTab = "general" | "location";
type TripManagerType = "flight" | "hotel" | "car" | "resource" | "todo" | "hero";

const LOCAL_STORAGE_KEY = "trip-planner-data-v1";
const GLOBAL_RESOURCES_KEY = "__trip_resources__";
const GLOBAL_HERO_KEY = "__trip_hero__";
const gridEditTabs: Array<{ id: GridEditTab; label: string; emoji: string }> = [
  { id: "general", label: "יום", emoji: "🗓️" },
  { id: "location", label: "מיקום", emoji: "📍" },
];

const locationImageQueries: Record<string, string[]> = {
  "ניו יורק": ["new-york-city", "manhattan-skyline"],
  "וושינגטון DC": ["washington-dc", "national-mall"],
  "הכביש המזרחי": ["scenic-road-trip", "coastal-highway"],
  "אורלנדו": ["orlando", "theme-park"],
  "Miami": ["miami-beach", "south-beach"],
  "Kennedy Space Center": ["kennedy-space-center", "space-shuttle"],
  "Norfolk": ["norfolk-virginia", "waterfront"],
  "Outer Banks": ["outer-banks", "sand-dunes"],
  "Beaufort": ["beaufort-north-carolina", "historic-waterfront"],
  "Charleston": ["charleston-south-carolina", "historic-district"],
  "Savannah": ["savannah-georgia", "forsyth-park"],
  "Appalachia": ["blue-ridge-parkway", "smoky-mountains"],
};

const attractionQueryMap: Array<{ test: RegExp; query: string[] }> = [
  { test: /statue of liberty|liberty/i, query: ["statue-of-liberty", "new-york"] },
  { test: /ellis island/i, query: ["ellis-island", "new-york-harbor"] },
  { test: /9\/11|one world trade|memorial/i, query: ["one-world-trade-center", "new-york"] },
  { test: /central park/i, query: ["central-park", "new-york"] },
  { test: /moma/i, query: ["museum-of-modern-art", "new-york"] },
  { test: /times square/i, query: ["times-square", "new-york-night"] },
  { test: /brooklyn bridge/i, query: ["brooklyn-bridge", "new-york"] },
  { test: /amtrak|train|union station/i, query: ["amtrak-train", "union-station"] },
  { test: /lincoln|white house|smithsonian|georgetown/i, query: ["washington-dc", "monuments"] },
  { test: /outer banks|ocracoke/i, query: ["outer-banks", "beach"] },
  { test: /charleston/i, query: ["charleston-south-carolina", "historic-street"] },
  { test: /savannah/i, query: ["savannah-georgia", "historic-square"] },
  { test: /kennedy/i, query: ["kennedy-space-center", "space-shuttle"] },
  { test: /epcot/i, query: ["epcot", "orlando"] },
  { test: /magic kingdom|disney/i, query: ["magic-kingdom", "orlando"] },
  { test: /animal kingdom/i, query: ["animal-kingdom", "orlando"] },
  { test: /universal|epic universe/i, query: ["universal-orlando", "theme-park"] },
  { test: /miami/i, query: ["miami-beach", "florida"] },
];

function formatGridDayLabel(date: string, dayName: string) {
  const cleanDayName = dayName.replace(/^יום\s+/, "");
  return `${formatDate(date)} - ${cleanDayName}`;
}

function buildLocationTagStyles(locationNames: string[]) {
  const uniqueNames = [...new Set(locationNames.map((name) => name.trim()).filter(Boolean))];
  const step = uniqueNames.length > 0 ? 360 / uniqueNames.length : 0;

  return Object.fromEntries(uniqueNames.map((name, index) => {
    const hue = Math.round((index * step + 18) % 360);
    const borderHue = Math.round((hue + 4) % 360);

    return [
      name,
      {
        background: `hsl(${hue} 88% 95%)`,
        color: `hsl(${hue} 55% 34%)`,
        borderColor: `hsl(${borderHue} 68% 78%)`,
      },
    ];
  }));
}

function buildLocationForm(day: TripDay | undefined, tripData: TripData): DayLocationForm {
  if (!day) return { name: "", region: "", lat: "", lng: "" };
  const overrideLocation = tripData.dayOverrides?.[day.date]?.location;

  return {
    name: overrideLocation?.name || day.location.name,
    region: overrideLocation?.region || day.location.region,
    lat: typeof overrideLocation?.lat === "number" ? String(overrideLocation.lat) : "",
    lng: typeof overrideLocation?.lng === "number" ? String(overrideLocation.lng) : "",
  };
}

function buildCarForm(car: DayCar | null): DayCarForm {
  return {
    startDate: car?.startDate || "",
    endDate: car?.endDate || car?.startDate || "",
    provider: car?.provider || "",
    pickup: car?.pickup || "",
    dropoff: car?.dropoff || "",
    confirmation: car?.confirmation || "",
    notes: car?.notes || "",
  };
}

function buildFlightForm(flight: Flight | undefined): DayFlightForm {
  const parsed = parseLegacyFlightDetails(flight?.details || "", flight?.date);
  return {
    label: flight?.label || "",
    airline: flight?.airline || "",
    from: flight?.from || parsed.from,
    stops: (flight?.stops || parsed.stops).join(", "),
    to: flight?.to || parsed.to,
    departureDate: flight?.departureDate || flight?.date || parsed.departureDate,
    departureTime: flight?.departureTime || parsed.departureTime,
    arrivalDate: flight?.arrivalDate || parsed.arrivalDate,
    arrivalTime: flight?.arrivalTime || parsed.arrivalTime,
    confirmation: flight?.confirmation || flight?.booking || "",
  };
}

function buildHotelForm(hotel: Hotel | undefined, date: string): DayHotelForm {
  return {
    name: hotel?.name || "",
    location: hotel?.location || "",
    address: hotel?.address || "",
    phone: hotel?.phone || "",
    confirmation: hotel?.confirmation || "",
    checkIn: hotel?.checkIn || date,
    checkOut: hotel?.checkOut || shiftIsoDate(date, 1),
  };
}

function shiftIsoDate(dateStr: string, delta: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + delta);

  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, "0"),
    String(next.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseStops(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function formatFlightDetails(form: DayFlightForm) {
  const route = [form.from.trim(), ...parseStops(form.stops), form.to.trim()].filter(Boolean).join(" → ");
  const parts = [route];
  if (form.departureDate || form.departureTime) {
    parts.push(`המראה ${[form.departureDate, form.departureTime].filter(Boolean).join(" ")}`.trim());
  }
  if (form.arrivalDate || form.arrivalTime) {
    parts.push(`נחיתה ${[form.arrivalDate, form.arrivalTime].filter(Boolean).join(" ")}`.trim());
  }
  if (form.airline.trim()) {
    parts.push(form.airline.trim());
  }
  return parts.filter(Boolean).join(" | ");
}

function parseLegacyFlightDetails(details: string, fallbackDate?: string) {
  const [routePart = "", ...otherParts] = details.split("|").map((part) => part.trim());
  const routeSegments = routePart.split("→").map((part) => part.trim()).filter(Boolean);
  const departureTime = otherParts.find((part) => part.includes("המראה"))?.replace("המראה", "").trim() || "";
  const arrivalRaw = otherParts.find((part) => part.includes("נחיתה"))?.replace("נחיתה", "").trim() || "";
  const plusOne = arrivalRaw.includes("(+1)");
  const arrivalTime = arrivalRaw.replace("(+1)", "").trim();

  return {
    from: routeSegments[0] || "",
    stops: routeSegments.slice(1, -1),
    to: routeSegments.at(-1) || "",
    departureDate: fallbackDate || "",
    departureTime,
    arrivalDate: fallbackDate ? shiftIsoDate(fallbackDate, plusOne ? 1 : 0) : "",
    arrivalTime,
  };
}

function formatCarDateRange(car: DayCar) {
  const startDate = car.startDate || "";
  const endDate = car.endDate || startDate;
  if (!startDate) return "";
  if (startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function parsePlanDraftItems(value: string, date: string): TripUpdateAction[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colonIndex = line.indexOf(":");
      const dashIndex = line.indexOf(" - ");
      const separatorIndex = colonIndex >= 0 ? colonIndex : dashIndex;

      if (separatorIndex >= 0) {
        const label = line.slice(0, separatorIndex).trim();
        const details = line.slice(separatorIndex + (colonIndex >= 0 ? 1 : 3)).trim();

        return {
          type: "add_event" as const,
          date,
          label: label || details,
          details: details || label,
          emoji: "📍",
        };
      }

      return {
        type: "add_event" as const,
        date,
        label: line,
        details: line,
        emoji: "📍",
      };
    })
    .filter((item) => item.label.trim() && item.details.trim());
}

function buildPhotoUrl(queryParts: string[], seed: string, width = 1200, height = 800) {
  const tags = queryParts
    .flatMap((part) => part.split(/[,\s]+/))
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join(",");

  return `https://loremflickr.com/${width}/${height}/${encodeURIComponent(tags)}?lock=${encodeURIComponent(seed)}`;
}

function getLocationImageQuery(day: TripDay) {
  return locationImageQueries[day.location.name] || [day.location.name, day.location.region];
}

function getDayGalleryImages(day: TripDay) {
  const eventQueries = day.events
    .map((event) => {
      const match = attractionQueryMap.find((entry) => entry.test.test(`${event.label} ${event.details}`));
      return match?.query ?? [event.label, day.location.name];
    })
    .slice(0, 3);

  const fallbackQueries = eventQueries.length
    ? eventQueries
    : [getLocationImageQuery(day), [day.title, day.location.name], [day.location.region, day.location.name]];

  return fallbackQueries.map((query, index) => ({
    src: buildPhotoUrl(query, `gallery-${day.date}-${index}`, 900, 620),
    alt: `${day.title} ${index + 1}`,
  }));
}

function DayPhoto({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className={`day-photo-fallback ${className || ""}`.trim()} aria-hidden="true" />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      fill
      sizes={className?.includes("grid-day-hero-image") ? "(max-width: 760px) 100vw, 33vw" : "(max-width: 760px) 100vw, 33vw"}
      onError={() => setFailed(true)}
    />
  );
}

export function TripGridView({ initialTripData }: TripGridViewProps) {
  const [currentTripData, setCurrentTripData] = useState<TripData>(() => {
    if (typeof window === "undefined") return initialTripData;

    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return initialTripData;

    try {
      return sanitizeTripData(JSON.parse(raw) as TripData);
    } catch {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      return initialTripData;
    }
  });
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<DayAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [tripManagerType, setTripManagerType] = useState<TripManagerType | null>(null);
  const [editingFlightIndex, setEditingFlightIndex] = useState<number | null>(null);
  const [editingHotelIndex, setEditingHotelIndex] = useState<number | null>(null);
  const [editingCarIndex, setEditingCarIndex] = useState<number | null>(null);
  const [editingResourceIndex, setEditingResourceIndex] = useState<number | null>(null);
  const [heroForm, setHeroForm] = useState<DestinationHeroForm>({ locationName: "", url: "", file: null });
  const [todoDraft, setTodoDraft] = useState("");
  const [editingTodoText, setEditingTodoText] = useState<string | null>(null);
  const [editingTodoValue, setEditingTodoValue] = useState("");
  const [activeEditTab, setActiveEditTab] = useState<GridEditTab>("general");
  const [titleForm, setTitleForm] = useState("");
  const [summaryForm, setSummaryForm] = useState("");
  const [planForm, setPlanForm] = useState("");
  const [locationForm, setLocationForm] = useState<DayLocationForm>({ name: "", region: "", lat: "", lng: "" });
  const [carForm, setCarForm] = useState<DayCarForm>({ startDate: "", endDate: "", provider: "", pickup: "", dropoff: "", confirmation: "", notes: "" });
  const [flightForm, setFlightForm] = useState<DayFlightForm>({
    label: "",
    airline: "",
    from: "",
    stops: "",
    to: "",
    departureDate: "",
    departureTime: "",
    arrivalDate: "",
    arrivalTime: "",
    confirmation: "",
  });
  const [hotelForm, setHotelForm] = useState<DayHotelForm>({ name: "", location: "", address: "", phone: "", confirmation: "", checkIn: "", checkOut: "" });
  const [resourceForm, setResourceForm] = useState<TripResourceForm>({ title: "", content: "", url: "", file: null });
  const [resourceUploadError, setResourceUploadError] = useState("");
  const [isUploadingResourceFile, setIsUploadingResourceFile] = useState(false);
  const [heroUploadError, setHeroUploadError] = useState("");
  const [isUploadingHeroFile, setIsUploadingHeroFile] = useState(false);
  const [swapTargetDate, setSwapTargetDate] = useState("");

  const days = useMemo(() => buildTripDays(currentTripData), [currentTripData]);
  const destinationOptions = useMemo(
    () => [...new Set(days.map((day) => day.location.name))],
    [days],
  );
  const locationTagStyles = useMemo(
    () => buildLocationTagStyles(days.map((day) => day.location.name)),
    [days],
  );
  const activeDay = openDate ? days.find((day) => day.date === openDate) ?? null : null;
  const openTodos = useMemo(
    () => currentTripData.todos.filter((todo) => !todo.done),
    [currentTripData.todos],
  );
  const closedTodos = useMemo(
    () => currentTripData.todos.filter((todo) => todo.done),
    [currentTripData.todos],
  );

  function closeModal() {
    setOpenDate(null);
    setAttachments([]);
    setAttachmentsLoading(false);
    setActiveEditTab("general");
  }

  function openTripManager(type: TripManagerType) {
    setTripManagerType(type);
    setIsFabOpen(false);
    setEditingFlightIndex(null);
    setEditingHotelIndex(null);
    setEditingCarIndex(null);
    setEditingResourceIndex(null);
    setResourceUploadError("");
    setHeroUploadError("");

    if (type === "flight") {
      setFlightForm({
        label: "",
        airline: "",
        from: "",
        stops: "",
        to: "",
        departureDate: activeDay?.date || currentTripData.startDate,
        departureTime: "",
        arrivalDate: activeDay?.date || currentTripData.startDate,
        arrivalTime: "",
        confirmation: "",
      });
    }

    if (type === "hotel") {
      setHotelForm({
        name: "",
        location: "",
        address: "",
        phone: "",
        confirmation: "",
        checkIn: activeDay?.date || currentTripData.startDate,
        checkOut: shiftIsoDate(activeDay?.date || currentTripData.startDate, 1),
      });
    }

    if (type === "car") {
      setCarForm({
        startDate: activeDay?.date || currentTripData.startDate,
        endDate: activeDay?.date || currentTripData.startDate,
        provider: "",
        pickup: "",
        dropoff: "",
        confirmation: "",
        notes: "",
      });
    }

    if (type === "resource") {
      setResourceForm({ title: "", content: "", url: "", file: null });
    }

    if (type === "todo") {
      setTodoDraft("");
      setEditingTodoText(null);
      setEditingTodoValue("");
    }

    if (type === "hero") {
      const locationName = activeDay?.location.name || destinationOptions[0] || "";
      const currentHero = currentTripData.destinationHeroes?.[locationName];
      setHeroForm({
        locationName,
        url: currentHero?.url || "",
        file: currentHero?.file || null,
      });
    }
  }

  function closeTripManager() {
    setTripManagerType(null);
    setEditingFlightIndex(null);
    setEditingHotelIndex(null);
    setEditingCarIndex(null);
    setEditingResourceIndex(null);
    setResourceUploadError("");
    setHeroUploadError("");
  }

  function syncEditorState(day: TripDay, tripData: TripData) {
    const overrideTitle = tripData.dayOverrides?.[day.date]?.title?.trim();
    const overrideSummary = tripData.dayOverrides?.[day.date]?.summary;
    setTitleForm(overrideTitle || day.title);
    setSummaryForm(typeof overrideSummary === "string" ? overrideSummary : day.summary);
    setLocationForm(buildLocationForm(day, tripData));
    setCarForm(buildCarForm(day.car));
    setFlightForm(buildFlightForm(day.flights[0]));
    setHotelForm(buildHotelForm(day.hotels[0], day.date));
    setPlanForm("");
    setSwapTargetDate("");
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentTripData));
  }, [currentTripData]);

  function commitTripData(nextTripData: TripData) {
    const sanitized = sanitizeTripData(nextTripData);
    setCurrentTripData(sanitized);
    if (activeDay) {
      const nextDay = buildTripDays(sanitized).find((day) => day.date === activeDay.date);
      if (nextDay) syncEditorState(nextDay, sanitized);
    }
  }

  useEffect(() => {
    if (!activeDay) return;

    let active = true;

    fetch(`/api/attachments?dayDate=${encodeURIComponent(activeDay.date)}`)
      .then(async (response) => {
        const payload = (await response.json()) as { attachments?: DayAttachment[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Failed to load attachments");
        return payload.attachments || [];
      })
      .then((items) => {
        if (!active) return;
        setAttachments(items);
      })
      .catch(() => {
        if (!active) return;
        setAttachments([]);
      })
      .finally(() => {
        if (!active) return;
        setAttachmentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeDay]);

  function applyDirectUpdates(updates: TripUpdateAction[]) {
    if (!updates.length) return;
    commitTripData(applyTripUpdates(currentTripData, updates));
  }

  function saveGeneral() {
    if (!activeDay) return;
    const updates: TripUpdateAction[] = [];
    if (titleForm.trim()) {
      updates.push({ type: "update_day_title", date: activeDay.date, title: titleForm.trim() });
    }
    if (summaryForm.trim()) {
      updates.push({ type: "update_day_summary", date: activeDay.date, summary: summaryForm.trim() });
    } else {
      updates.push({ type: "clear_day_summary", date: activeDay.date });
    }
    updates.push(...parsePlanDraftItems(planForm, activeDay.date));
    applyDirectUpdates(updates);
    setPlanForm("");
  }

  function saveLocation() {
    if (!activeDay || !locationForm.name.trim()) return;
    applyDirectUpdates([{
      type: "update_location",
      date: activeDay.date,
      name: locationForm.name.trim(),
      region: locationForm.region.trim() || undefined,
      lat: parseOptionalNumber(locationForm.lat),
      lng: parseOptionalNumber(locationForm.lng),
    }]);
  }

  function removeLocation() {
    if (!activeDay) return;
    applyDirectUpdates([{ type: "clear_location", date: activeDay.date }]);
  }

  function removeEvent(label: string) {
    if (!activeDay) return;
    applyDirectUpdates([{ type: "delete_event", date: activeDay.date, label }]);
  }

  function swapDayContent() {
    if (!activeDay || !swapTargetDate || swapTargetDate === activeDay.date) return;
    applyDirectUpdates([{ type: "swap_day_content", fromDate: activeDay.date, toDate: swapTargetDate }]);
  }

  function beginEditFlight(index: number) {
    const flight = currentTripData.flights[index];
    if (!flight) return;
    setEditingFlightIndex(index);
    setFlightForm(buildFlightForm(flight));
    setTripManagerType("flight");
  }

  function saveTripFlight() {
    if (!flightForm.label.trim() || !flightForm.from.trim() || !flightForm.to.trim()) return;
    const details = formatFlightDetails(flightForm);
    const nextFlights = [...currentTripData.flights];
    const nextFlight: Flight = {
      date: flightForm.departureDate || currentTripData.startDate,
      label: flightForm.label.trim(),
      details,
      booking: flightForm.confirmation.trim() || undefined,
      confirmation: flightForm.confirmation.trim() || undefined,
      airline: flightForm.airline.trim() || undefined,
      from: flightForm.from.trim(),
      stops: parseStops(flightForm.stops),
      to: flightForm.to.trim(),
      departureDate: flightForm.departureDate || undefined,
      departureTime: flightForm.departureTime.trim() || undefined,
      arrivalDate: flightForm.arrivalDate || undefined,
      arrivalTime: flightForm.arrivalTime.trim() || undefined,
    };

    if (editingFlightIndex !== null && nextFlights[editingFlightIndex]) {
      nextFlights[editingFlightIndex] = nextFlight;
    } else {
      nextFlights.push(nextFlight);
    }

    commitTripData({ ...currentTripData, flights: nextFlights });
    closeTripManager();
  }

  function deleteTripFlight(index: number) {
    commitTripData({
      ...currentTripData,
      flights: currentTripData.flights.filter((_, currentIndex) => currentIndex !== index),
    });
    if (editingFlightIndex === index) closeTripManager();
  }

  function beginEditHotel(index: number) {
    const hotel = currentTripData.hotels[index];
    if (!hotel) return;
    setEditingHotelIndex(index);
    setHotelForm(buildHotelForm(hotel, hotel.checkIn));
    setTripManagerType("hotel");
  }

  function saveTripHotel() {
    if (!hotelForm.name.trim() || !hotelForm.location.trim() || !hotelForm.address.trim() || !hotelForm.checkIn || !hotelForm.checkOut) return;
    const nextHotels = [...currentTripData.hotels];
    const nextHotel: Hotel = {
      name: hotelForm.name.trim(),
      location: hotelForm.location.trim(),
      address: hotelForm.address.trim(),
      phone: hotelForm.phone.trim() || undefined,
      confirmation: hotelForm.confirmation.trim() || undefined,
      checkIn: hotelForm.checkIn,
      checkOut: hotelForm.checkOut,
    };

    if (editingHotelIndex !== null && nextHotels[editingHotelIndex]) {
      nextHotels[editingHotelIndex] = nextHotel;
    } else {
      nextHotels.push(nextHotel);
    }

    commitTripData({ ...currentTripData, hotels: nextHotels });
    closeTripManager();
  }

  function deleteTripHotel(index: number) {
    commitTripData({
      ...currentTripData,
      hotels: currentTripData.hotels.filter((_, currentIndex) => currentIndex !== index),
    });
    if (editingHotelIndex === index) closeTripManager();
  }

  function beginEditCar(index: number) {
    const car = currentTripData.cars?.[index];
    if (!car) return;
    setEditingCarIndex(index);
    setCarForm(buildCarForm(car));
    setTripManagerType("car");
  }

  function saveTripCar() {
    if (!carForm.provider.trim() || !carForm.startDate || !carForm.endDate) return;
    const nextCars = [...(currentTripData.cars ?? [])];
    const nextCar: DayCar = {
      startDate: carForm.startDate,
      endDate: carForm.endDate,
      provider: carForm.provider.trim(),
      pickup: carForm.pickup.trim() || undefined,
      dropoff: carForm.dropoff.trim() || undefined,
      confirmation: carForm.confirmation.trim() || undefined,
      notes: carForm.notes.trim() || undefined,
    };

    if (editingCarIndex !== null && nextCars[editingCarIndex]) {
      nextCars[editingCarIndex] = nextCar;
    } else {
      nextCars.push(nextCar);
    }

    commitTripData({ ...currentTripData, cars: nextCars });
    closeTripManager();
  }

  function deleteTripCar(index: number) {
    commitTripData({
      ...currentTripData,
      cars: (currentTripData.cars ?? []).filter((_, currentIndex) => currentIndex !== index),
    });
    if (editingCarIndex === index) closeTripManager();
  }

  function beginEditResource(index: number) {
    const resource = currentTripData.resources?.[index];
    if (!resource) return;
    setEditingResourceIndex(index);
    setResourceForm({
      title: resource.title,
      content: resource.content || "",
      url: resource.url || "",
      file: resource.file || null,
    });
    setTripManagerType("resource");
    setResourceUploadError("");
  }

  async function handleResourceFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingResourceFile(true);
      setResourceUploadError("");
      const formData = new FormData();
      formData.append("dayDate", GLOBAL_RESOURCES_KEY);
      formData.append("files", file);

      const response = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { attachments?: DayAttachment[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Upload failed");
      const uploaded = payload.attachments?.[0];
      if (!uploaded) throw new Error("לא התקבל קובץ שמור.");

      setResourceForm((current) => ({
        ...current,
        file: uploaded,
      }));
    } catch (error) {
      setResourceUploadError(error instanceof Error ? error.message : "העלאת הקובץ נכשלה.");
    } finally {
      setIsUploadingResourceFile(false);
      event.target.value = "";
    }
  }

  async function removeResourceFile() {
    if (!resourceForm.file) return;
    try {
      const response = await fetch("/api/attachments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: resourceForm.file.url }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Delete failed");
      setResourceForm((current) => ({ ...current, file: null }));
      setResourceUploadError("");
    } catch (error) {
      setResourceUploadError(error instanceof Error ? error.message : "מחיקת הקובץ נכשלה.");
    }
  }

  function saveTripResource() {
    if (!resourceForm.title.trim()) return;
    const nextResources = [...(currentTripData.resources ?? [])];
    const nextResource: TripResource = {
      title: resourceForm.title.trim(),
      content: resourceForm.content.trim() || undefined,
      url: resourceForm.url.trim() || undefined,
      file: resourceForm.file || undefined,
    };

    if (editingResourceIndex !== null && nextResources[editingResourceIndex]) {
      nextResources[editingResourceIndex] = nextResource;
    } else {
      nextResources.push(nextResource);
    }

    commitTripData({ ...currentTripData, resources: nextResources });
    closeTripManager();
  }

  async function deleteTripResource(index: number) {
    const resource = currentTripData.resources?.[index];
    if (resource?.file?.url) {
      await fetch("/api/attachments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: resource.file.url }),
      }).catch(() => null);
    }

    commitTripData({
      ...currentTripData,
      resources: (currentTripData.resources ?? []).filter((_, currentIndex) => currentIndex !== index),
    });
    if (editingResourceIndex === index) closeTripManager();
  }

  async function handleHeroFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingHeroFile(true);
      setHeroUploadError("");
      const formData = new FormData();
      formData.append("dayDate", `${GLOBAL_HERO_KEY}-${heroForm.locationName}`);
      formData.append("files", file);

      const response = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { attachments?: DayAttachment[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Upload failed");
      const uploaded = payload.attachments?.[0];
      if (!uploaded) throw new Error("לא התקבל קובץ hero.");

      setHeroForm((current) => ({
        ...current,
        file: uploaded,
      }));
    } catch (error) {
      setHeroUploadError(error instanceof Error ? error.message : "העלאת תמונת ה-hero נכשלה.");
    } finally {
      setIsUploadingHeroFile(false);
      event.target.value = "";
    }
  }

  async function removeHeroFile() {
    if (!heroForm.file) return;
    try {
      const response = await fetch("/api/attachments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: heroForm.file.url }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Delete failed");
      setHeroForm((current) => ({ ...current, file: null }));
      setHeroUploadError("");
    } catch (error) {
      setHeroUploadError(error instanceof Error ? error.message : "מחיקת תמונת ה-hero נכשלה.");
    }
  }

  function saveDestinationHero() {
    if (!heroForm.locationName) return;
    const nextHeroes: Record<string, DestinationHero> = {
      ...(currentTripData.destinationHeroes ?? {}),
      [heroForm.locationName]: {
        url: heroForm.url.trim() || undefined,
        file: heroForm.file || undefined,
      },
    };
    commitTripData({ ...currentTripData, destinationHeroes: nextHeroes });
    closeTripManager();
  }

  async function clearDestinationHero() {
    if (!heroForm.locationName) return;
    const existingHero = currentTripData.destinationHeroes?.[heroForm.locationName];
    if (existingHero?.file?.url) {
      await fetch("/api/attachments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: existingHero.file.url }),
      }).catch(() => null);
    }

    const nextHeroes = { ...(currentTripData.destinationHeroes ?? {}) };
    delete nextHeroes[heroForm.locationName];
    commitTripData({ ...currentTripData, destinationHeroes: nextHeroes });
    setHeroForm((current) => ({ ...current, url: "", file: null }));
    closeTripManager();
  }

  function addTodo() {
    const text = todoDraft.trim();
    if (!text) return;
    applyDirectUpdates([{ type: "add_todo", text }]);
    setTodoDraft("");
  }

  function toggleTodo(todoText: string, done: boolean) {
    applyDirectUpdates([{ type: done ? "reopen_todo" : "complete_todo", text: todoText }]);
  }

  function beginEditTodo(todoText: string) {
    setEditingTodoText(todoText);
    setEditingTodoValue(todoText);
  }

  function resetTodoEditor() {
    setEditingTodoText(null);
    setEditingTodoValue("");
    setTodoDraft("");
  }

  function saveTodoEdit() {
    const nextText = editingTodoValue.trim();
    if (!editingTodoText || !nextText) return;
    commitTripData({
      ...currentTripData,
      todos: currentTripData.todos.map((todo) =>
        todo.text === editingTodoText ? { ...todo, text: nextText } : todo,
      ),
    });
    resetTodoEditor();
  }

  function deleteTodo(todoText: string) {
    commitTripData({
      ...currentTripData,
      todos: currentTripData.todos.filter((todo) => todo.text !== todoText),
    });
    if (editingTodoText === todoText) {
      resetTodoEditor();
    }
  }

  return (
    <main className="grid-view-shell">
      <section className="grid-view-hero">
        <div>
          <span className="eyebrow">Alt View • ניסוי תצוגה</span>
          <h1>ציר זמן רוחבי ופתיחת יום בפופאפ</h1>
          <p className="lead">
            זהו עמוד חלופי לניסוי UX. כל הימים מוצגים בגריד לכל רוחב העמוד, ובלחיצה על יום נפתח חלון עם התוכן הקיים שלו.
          </p>
        </div>
        <Link className="grid-view-back" href="/">
          חזרה לתצוגה הראשית
        </Link>
      </section>

      <section className="grid-view-board">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            className="grid-day-card"
            onClick={() => {
              setAttachmentsLoading(true);
              syncEditorState(day, currentTripData);
              setOpenDate(day.date);
            }}
          >
            <div className="grid-day-top">
              <span className="grid-day-date">{formatGridDayLabel(day.date, day.dayName)}</span>
              <span className="grid-day-chip" style={locationTagStyles[day.location.name]}>📍 {day.location.name}</span>
            </div>
            {day.travelMode !== "יום יעד" ? (
              <span className="grid-day-kicker">{day.travelMode}</span>
            ) : null}
            <div className="grid-day-title">{day.title}</div>
            {day.summary ? <div className="grid-day-summary">{day.summary}</div> : null}
            <div className="grid-day-footer">
              {day.flights.length ? <span className="chip">✈️ {day.flights.length}</span> : null}
              {day.hotels.length ? <span className="chip">🏨 {day.hotels.length}</span> : null}
              {day.events.length ? <span className="chip">🗓️ {day.events.length}</span> : null}
            </div>
          </button>
        ))}
      </section>

      {activeDay ? (
        <div className="day-modal-overlay" onClick={closeModal}>
          <section className="day-modal" onClick={(event) => event.stopPropagation()}>
            <div className="day-modal-head">
              <div>
                <div className="section-title">{activeDay.dayName} · {formatDate(activeDay.date)}</div>
                <h2>{activeDay.title}</h2>
                {activeDay.summary ? <p>{activeDay.summary}</p> : null}
              </div>
              <Button variant="ghost" size="icon" onClick={closeModal} aria-label="סגור פרטי יום">
                ✕
              </Button>
            </div>

            <div className="day-modal-meta">
              <span className="chip" style={locationTagStyles[activeDay.location.name]}>📍 {activeDay.location.name}</span>
              <span className="chip">{activeDay.location.region}</span>
              {activeDay.travelMode !== "יום יעד" ? <span className="chip">{activeDay.travelMode}</span> : null}
            </div>

            <section className="day-gallery">
              {getDayGalleryImages(activeDay).map((image) => (
                <div key={image.src} className="day-gallery-item">
                  <DayPhoto src={image.src} alt={image.alt} className="day-gallery-image" />
                </div>
              ))}
            </section>

            <section className="day-modal-quick-links">
              <Button variant="glass" size="sm" onClick={() => openTripManager("flight")}>ניהול טיסות</Button>
              <Button variant="glass" size="sm" onClick={() => openTripManager("hotel")}>ניהול מלונות</Button>
              <Button variant="glass" size="sm" onClick={() => openTripManager("car")}>ניהול רכבים</Button>
              <Button variant="glass" size="sm" onClick={() => openTripManager("resource")}>קבצים וקישורים</Button>
              <Button variant="glass" size="sm" onClick={() => setActiveEditTab("location")}>ערוך מיקום</Button>
            </section>

            <section className="day-modal-editor">
              <div className="day-modal-editor-head">
                <h3>עריכת יום</h3>
                <p>אפשר לעדכן את פרטי היום ישירות מתוך הפופאפ.</p>
              </div>

              <div className="day-modal-tabs" role="tablist" aria-label="עריכת יום">
                {gridEditTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`day-modal-tab ${activeEditTab === tab.id ? "active" : ""}`}
                    onClick={() => setActiveEditTab(tab.id)}
                  >
                    <span>{tab.emoji}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {activeEditTab === "general" ? (
                <div className="day-modal-editor-grid">
                  <label className="day-modal-field">
                    <span>כותרת יום</span>
                    <input value={titleForm} onChange={(event) => setTitleForm(event.target.value)} />
                  </label>
                  <label className="day-modal-field">
                    <span>סיכום יום</span>
                    <textarea rows={3} value={summaryForm} onChange={(event) => setSummaryForm(event.target.value)} />
                  </label>
                  <label className="day-modal-field">
                    <span>הוסף פריטי תכנון</span>
                    <textarea
                      rows={4}
                      placeholder={"שורה לכל פריט\nמסעדה: הזמנה ל-20:00\nמוזיאון - להגיע מוקדם"}
                      value={planForm}
                      onChange={(event) => setPlanForm(event.target.value)}
                    />
                  </label>
                  <div className="day-modal-actions">
                    <Button variant="primary" onClick={saveGeneral}>שמור</Button>
                  </div>
                  <div className="day-modal-swap">
                    <label className="day-modal-field">
                      <span>החלף תוכן עם יום אחר</span>
                      <select
                        value={swapTargetDate}
                        onChange={(event) => setSwapTargetDate(event.target.value)}
                      >
                        <option value="">בחר יום יעד</option>
                        {days.filter((day) => day.date !== activeDay.date).map((day) => (
                          <option key={day.date} value={day.date}>
                            {formatGridDayLabel(day.date, day.dayName)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="day-modal-actions">
                      <Button variant="glass" onClick={swapDayContent} disabled={!swapTargetDate}>
                        החלף בין הימים
                      </Button>
                    </div>
                    <p className="day-modal-help">
                      הפעולה מחליפה בין הימים את הכותרת, הסיכום, המיקום, הטיסות, הרכב ופריטי התכנון. מלונות נשארים כרגע בלי שינוי.
                    </p>
                  </div>
                  {activeDay.events.length ? (
                    <div className="day-modal-existing">
                      {activeDay.events.map((event) => (
                        <div key={`${event.date}-${event.label}`} className="day-modal-existing-item">
                          <span>{event.emoji} {event.label}</span>
                          <Button variant="ghost" size="sm" onClick={() => removeEvent(event.label)}>מחק</Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeEditTab === "location" ? (
                <div className="day-modal-editor-grid two-cols">
                  <label className="day-modal-field">
                    <span>שם מיקום</span>
                    <input value={locationForm.name} onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>אזור</span>
                    <input value={locationForm.region} onChange={(event) => setLocationForm((current) => ({ ...current, region: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>Lat</span>
                    <input value={locationForm.lat} onChange={(event) => setLocationForm((current) => ({ ...current, lat: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>Lng</span>
                    <input value={locationForm.lng} onChange={(event) => setLocationForm((current) => ({ ...current, lng: event.target.value }))} />
                  </label>
                  <div className="day-modal-actions">
                    <Button variant="primary" onClick={saveLocation}>שמור מיקום</Button>
                    <Button variant="ghost" onClick={removeLocation}>הסר מיקום</Button>
                  </div>
                </div>
              ) : null}

            </section>

            {activeDay.flights.length ? (
              <section className="day-modal-section">
                <div className="day-modal-section-head">
                  <h3>טיסות</h3>
                  <Button variant="ghost" size="sm" onClick={() => openTripManager("flight")}>ערוך</Button>
                </div>
                <div className="day-modal-list">
                  {activeDay.flights.map((flight) => (
                    <article key={`${flight.date}-${flight.label}`} className="day-modal-item logistics-card-compact">
                      <strong>✈️ {flight.label}</strong>
                      <p>{[flight.airline, [flight.from, ...(flight.stops ?? []), flight.to].filter(Boolean).join(" → ")].filter(Boolean).join(" · ") || flight.details}</p>
                      <p>{[[flight.departureDate ? formatDate(flight.departureDate) : "", flight.departureTime].filter(Boolean).join(" "), [flight.arrivalDate ? formatDate(flight.arrivalDate) : "", flight.arrivalTime].filter(Boolean).join(" ")].filter(Boolean).join(" → ")}</p>
                      {flight.confirmation || flight.booking ? <p>אישור: {flight.confirmation || flight.booking}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeDay.hotels.length ? (
              <section className="day-modal-section">
                <div className="day-modal-section-head">
                  <h3>מלון</h3>
                  <Button variant="ghost" size="sm" onClick={() => openTripManager("hotel")}>ערוך</Button>
                </div>
                <div className="day-modal-list">
                  {activeDay.hotels.map((hotel) => (
                    <article key={`${hotel.name}-${hotel.checkIn}`} className="day-modal-item logistics-card-compact">
                      <strong>🏨 {hotel.name}</strong>
                      <p>{hotel.location}</p>
                      <p>{hotel.address}</p>
                      <p>{formatDate(hotel.checkIn)} → {formatDate(shiftIsoDate(hotel.checkOut, -1))}</p>
                      {hotel.confirmation ? <p>אישור: {hotel.confirmation}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeDay.car ? (
              <section className="day-modal-section">
                <div className="day-modal-section-head">
                  <h3>רכב</h3>
                  <Button variant="ghost" size="sm" onClick={() => openTripManager("car")}>ערוך</Button>
                </div>
                <article className="day-modal-item">
                  <strong>🚗 {activeDay.car.provider || "רכב ליום"}</strong>
                  <p>{[formatCarDateRange(activeDay.car), activeDay.car.pickup, activeDay.car.dropoff, activeDay.car.notes].filter(Boolean).join(" · ") || "יש רכב משויך ליום הזה."}</p>
                  {activeDay.car.confirmation ? <p>אישור: {activeDay.car.confirmation}</p> : null}
                </article>
              </section>
            ) : null}

            <section className="day-modal-section">
              <h3>תכנון היום</h3>
              <div className="day-modal-list">
                {activeDay.events.length ? activeDay.events.map((event) => (
                  <article key={`${event.date}-${event.label}`} className="day-modal-item">
                    <strong>{event.emoji} {event.label}</strong>
                    <p>{event.details}</p>
                  </article>
                )) : (
                  <article className="day-modal-item">
                    <strong>🗓️ אין עדיין פריטי יום</strong>
                    <p>ליום הזה אין עדיין פריטי תכנון שמורים.</p>
                  </article>
                )}
              </div>
            </section>

            <section className="day-modal-section">
              <h3>קבצים</h3>
              <div className="day-modal-list">
                {attachmentsLoading ? (
                  <article className="day-modal-item">
                    <p>טוען קבצים...</p>
                  </article>
                ) : attachments.length ? attachments.map((attachment) => (
                  <article key={attachment.url} className="day-modal-item">
                    <strong>📎 {attachment.name}</strong>
                    <p>{attachment.contentType || "קובץ"}</p>
                  </article>
                )) : (
                  <article className="day-modal-item">
                    <p>אין קבצים ליום הזה.</p>
                  </article>
                )}
              </div>
            </section>
          </section>
        </div>
      ) : null}

      <div className="grid-fab-wrap">
        {isFabOpen ? (
          <div className="grid-fab-menu">
            <button type="button" className="grid-fab-option" onClick={() => openTripManager("flight")}>✈️ טיסות</button>
            <button type="button" className="grid-fab-option" onClick={() => openTripManager("car")}>🚗 רכב</button>
            <button type="button" className="grid-fab-option" onClick={() => openTripManager("hotel")}>🏨 מלונות</button>
            <button type="button" className="grid-fab-option" onClick={() => openTripManager("resource")}>🔗 קבצים וקישורים</button>
            <button type="button" className="grid-fab-option" onClick={() => openTripManager("todo")}>✅ משימות פתוחות לסגירה</button>
          </div>
        ) : null}
        <button
          type="button"
          className={`grid-fab ${isFabOpen ? "open" : ""}`}
          onClick={() => setIsFabOpen((current) => !current)}
          aria-label={isFabOpen ? "סגור תפריט הוספה" : "פתח תפריט הוספה"}
        >
          +
        </button>
      </div>

      {tripManagerType ? (
        <div className="day-modal-overlay" onClick={closeTripManager}>
          <section className="day-modal trip-manager-modal" onClick={(event) => event.stopPropagation()}>
            <div className="day-modal-head">
              <div>
                <div className="section-title">ניהול ברמת הטיול</div>
                <h2>
                  {tripManagerType === "flight"
                    ? "טיסות"
                    : tripManagerType === "hotel"
                      ? "מלונות"
                      : tripManagerType === "car"
                        ? "רכבים"
                        : tripManagerType === "hero"
                          ? "תמונות יעד"
                        : tripManagerType === "resource"
                          ? "קבצים וקישורים"
                          : "משימות פתוחות לסגירה"}
                </h2>
                <p>כאן מנהלים את הלוגיסטיקה של כל הטיול, בלי קשר ליום אחד ספציפי.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeTripManager} aria-label="סגור ניהול טיול">
                ✕
              </Button>
            </div>

            {tripManagerType === "flight" ? (
              <div className="trip-manager-grid">
                <div className="trip-manager-list">
                  {currentTripData.flights.map((flight, index) => (
                    <button key={`${flight.date}-${flight.label}-${index}`} type="button" className={`trip-manager-item ${editingFlightIndex === index ? "active" : ""}`} onClick={() => beginEditFlight(index)}>
                      <strong>{flight.label}</strong>
                      <span>{[flight.airline, [flight.from, ...(flight.stops ?? []), flight.to].filter(Boolean).join(" → ")].filter(Boolean).join(" · ") || flight.details}</span>
                    </button>
                  ))}
                </div>
                <div className="day-modal-editor-grid two-cols">
                  <label className="day-modal-field">
                    <span>כותרת טיסה</span>
                    <input value={flightForm.label} onChange={(event) => setFlightForm((current) => ({ ...current, label: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>חברת תעופה</span>
                    <input value={flightForm.airline} onChange={(event) => setFlightForm((current) => ({ ...current, airline: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>מ־</span>
                    <input value={flightForm.from} onChange={(event) => setFlightForm((current) => ({ ...current, from: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>אל</span>
                    <input value={flightForm.to} onChange={(event) => setFlightForm((current) => ({ ...current, to: event.target.value }))} />
                  </label>
                  <label className="day-modal-field field-span-2">
                    <span>עצירות ביניים</span>
                    <input value={flightForm.stops} onChange={(event) => setFlightForm((current) => ({ ...current, stops: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>תאריך המראה</span>
                    <input type="date" value={flightForm.departureDate} onChange={(event) => setFlightForm((current) => ({ ...current, departureDate: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>שעת המראה</span>
                    <input type="time" value={flightForm.departureTime} onChange={(event) => setFlightForm((current) => ({ ...current, departureTime: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>תאריך נחיתה</span>
                    <input type="date" value={flightForm.arrivalDate} onChange={(event) => setFlightForm((current) => ({ ...current, arrivalDate: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>שעת נחיתה</span>
                    <input type="time" value={flightForm.arrivalTime} onChange={(event) => setFlightForm((current) => ({ ...current, arrivalTime: event.target.value }))} />
                  </label>
                  <label className="day-modal-field field-span-2">
                    <span>מספר אישור</span>
                    <input value={flightForm.confirmation} onChange={(event) => setFlightForm((current) => ({ ...current, confirmation: event.target.value }))} />
                  </label>
                  <div className="day-modal-actions">
                    <Button variant="primary" onClick={saveTripFlight}>{editingFlightIndex !== null ? "שמור שינויים" : "הוסף טיסה"}</Button>
                    {editingFlightIndex !== null ? <Button variant="ghost" onClick={() => deleteTripFlight(editingFlightIndex)}>מחק</Button> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tripManagerType === "hotel" ? (
              <div className="trip-manager-grid">
                <div className="trip-manager-list">
                  {currentTripData.hotels.map((hotel, index) => (
                    <button key={`${hotel.checkIn}-${hotel.name}-${index}`} type="button" className={`trip-manager-item ${editingHotelIndex === index ? "active" : ""}`} onClick={() => beginEditHotel(index)}>
                      <strong>{hotel.name}</strong>
                      <span>{hotel.location} · {formatDate(hotel.checkIn)} - {formatDate(shiftIsoDate(hotel.checkOut, -1))}</span>
                    </button>
                  ))}
                </div>
                <div className="day-modal-editor-grid two-cols">
                  <label className="day-modal-field">
                    <span>שם מלון</span>
                    <input value={hotelForm.name} onChange={(event) => setHotelForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>מיקום</span>
                    <input value={hotelForm.location} onChange={(event) => setHotelForm((current) => ({ ...current, location: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>Check-in</span>
                    <input type="date" value={hotelForm.checkIn} onChange={(event) => setHotelForm((current) => ({ ...current, checkIn: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>Check-out</span>
                    <input type="date" value={hotelForm.checkOut} onChange={(event) => setHotelForm((current) => ({ ...current, checkOut: event.target.value }))} />
                  </label>
                  <label className="day-modal-field field-span-2">
                    <span>כתובת</span>
                    <input value={hotelForm.address} onChange={(event) => setHotelForm((current) => ({ ...current, address: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>טלפון</span>
                    <input value={hotelForm.phone} onChange={(event) => setHotelForm((current) => ({ ...current, phone: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>מספר אישור</span>
                    <input value={hotelForm.confirmation} onChange={(event) => setHotelForm((current) => ({ ...current, confirmation: event.target.value }))} />
                  </label>
                  <div className="day-modal-actions">
                    <Button variant="primary" onClick={saveTripHotel}>{editingHotelIndex !== null ? "שמור שינויים" : "הוסף מלון"}</Button>
                    {editingHotelIndex !== null ? <Button variant="ghost" onClick={() => deleteTripHotel(editingHotelIndex)}>מחק</Button> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tripManagerType === "car" ? (
              <div className="trip-manager-grid">
                <div className="trip-manager-list">
                  {(currentTripData.cars ?? []).map((car, index) => (
                    <button key={`${car.startDate}-${car.provider}-${index}`} type="button" className={`trip-manager-item ${editingCarIndex === index ? "active" : ""}`} onClick={() => beginEditCar(index)}>
                      <strong>{car.provider || "רכב"}</strong>
                      <span>{[formatCarDateRange(car), car.pickup, car.dropoff].filter(Boolean).join(" · ")}</span>
                    </button>
                  ))}
                </div>
                <div className="day-modal-editor-grid two-cols">
                  <label className="day-modal-field">
                    <span>מתאריך</span>
                    <input type="date" value={carForm.startDate} onChange={(event) => setCarForm((current) => ({ ...current, startDate: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>עד תאריך</span>
                    <input type="date" value={carForm.endDate} onChange={(event) => setCarForm((current) => ({ ...current, endDate: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>חברת השכרה</span>
                    <input value={carForm.provider} onChange={(event) => setCarForm((current) => ({ ...current, provider: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>מיקום לקיחה</span>
                    <input value={carForm.pickup} onChange={(event) => setCarForm((current) => ({ ...current, pickup: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>מיקום החזרה</span>
                    <input value={carForm.dropoff} onChange={(event) => setCarForm((current) => ({ ...current, dropoff: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>מספר אישור</span>
                    <input value={carForm.confirmation} onChange={(event) => setCarForm((current) => ({ ...current, confirmation: event.target.value }))} />
                  </label>
                  <label className="day-modal-field field-span-2">
                    <span>הערות</span>
                    <textarea rows={3} value={carForm.notes} onChange={(event) => setCarForm((current) => ({ ...current, notes: event.target.value }))} />
                  </label>
                  <div className="day-modal-actions">
                    <Button variant="primary" onClick={saveTripCar}>{editingCarIndex !== null ? "שמור שינויים" : "הוסף רכב"}</Button>
                    {editingCarIndex !== null ? <Button variant="ghost" onClick={() => deleteTripCar(editingCarIndex)}>מחק</Button> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tripManagerType === "hero" ? (
              <div className="trip-manager-grid">
                <div className="trip-manager-list">
                  {destinationOptions.map((locationName) => {
                    const hero = currentTripData.destinationHeroes?.[locationName];
                    return (
                      <button
                        key={locationName}
                        type="button"
                        className={`trip-manager-item ${heroForm.locationName === locationName ? "active" : ""}`}
                        onClick={() => setHeroForm({
                          locationName,
                          url: hero?.url || "",
                          file: hero?.file || null,
                        })}
                      >
                        <strong>{locationName}</strong>
                        <span>{hero?.file?.name || hero?.url || "אין תמונת hero מותאמת"}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="day-modal-editor-grid">
                  <label className="day-modal-field">
                    <span>יעד</span>
                    <select
                      value={heroForm.locationName}
                      onChange={(event) => {
                        const locationName = event.target.value;
                        const hero = currentTripData.destinationHeroes?.[locationName];
                        setHeroForm({
                          locationName,
                          url: hero?.url || "",
                          file: hero?.file || null,
                        });
                      }}
                    >
                      {destinationOptions.map((locationName) => (
                        <option key={locationName} value={locationName}>
                          {locationName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="day-modal-field">
                    <span>קישור לתמונת hero</span>
                    <input value={heroForm.url} onChange={(event) => setHeroForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." />
                  </label>
                  <label className="day-modal-field">
                    <span>או העלאת קובץ</span>
                    <input type="file" accept="image/*" onChange={handleHeroFileSelect} disabled={isUploadingHeroFile} />
                  </label>
                  {heroForm.file ? (
                    <div className="resource-file-card">
                      <div>
                        <strong>{heroForm.file.name}</strong>
                        <span>{heroForm.file.contentType || "תמונת hero"}</span>
                      </div>
                      <div className="day-modal-actions">
                        <Button variant="ghost" size="sm" onClick={() => window.open(`/api/attachments/file?pathname=${encodeURIComponent(heroForm.file!.pathname)}`, "_blank", "noopener,noreferrer")}>פתח</Button>
                        <Button variant="ghost" size="sm" onClick={removeHeroFile}>הסר קובץ</Button>
                      </div>
                    </div>
                  ) : null}
                  {heroUploadError ? <div className="attachments-error">{heroUploadError}</div> : null}
                  <p className="day-modal-help">
                    התמונה תחול אוטומטית על כל יום שהיעד הראשי שלו הוא {heroForm.locationName || "היעד שנבחר"}.
                  </p>
                  <div className="day-modal-actions">
                    <Button variant="primary" onClick={saveDestinationHero}>שמור תמונת יעד</Button>
                    <Button variant="ghost" onClick={clearDestinationHero}>נקה תמונה</Button>
                  </div>
                </div>
              </div>
            ) : null}

            {tripManagerType === "resource" ? (
              <div className="trip-manager-grid">
                <div className="trip-manager-list">
                  {(currentTripData.resources ?? []).map((resource, index) => (
                    <button key={`${resource.title}-${index}`} type="button" className={`trip-manager-item ${editingResourceIndex === index ? "active" : ""}`} onClick={() => beginEditResource(index)}>
                      <strong>{resource.title}</strong>
                      <span>{resource.content || resource.url || resource.file?.name || "פריט מידע"}</span>
                    </button>
                  ))}
                </div>
                <div className="day-modal-editor-grid">
                  <label className="day-modal-field">
                    <span>כותרת</span>
                    <input value={resourceForm.title} onChange={(event) => setResourceForm((current) => ({ ...current, title: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>תוכן</span>
                    <textarea rows={4} value={resourceForm.content} onChange={(event) => setResourceForm((current) => ({ ...current, content: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>לינק</span>
                    <input value={resourceForm.url} onChange={(event) => setResourceForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." />
                  </label>
                  <label className="day-modal-field">
                    <span>קובץ להעלאה</span>
                    <input type="file" onChange={handleResourceFileSelect} disabled={isUploadingResourceFile} />
                  </label>
                  {resourceForm.file ? (
                    <div className="resource-file-card">
                      <div>
                        <strong>{resourceForm.file.name}</strong>
                        <span>{resourceForm.file.contentType || "קובץ"}</span>
                      </div>
                      <div className="day-modal-actions">
                        <Button variant="ghost" size="sm" onClick={() => window.open(`/api/attachments/file?pathname=${encodeURIComponent(resourceForm.file!.pathname)}`, "_blank", "noopener,noreferrer")}>פתח</Button>
                        <Button variant="ghost" size="sm" onClick={removeResourceFile}>הסר קובץ</Button>
                      </div>
                    </div>
                  ) : null}
                  {resourceUploadError ? <div className="attachments-error">{resourceUploadError}</div> : null}
                  <div className="day-modal-actions">
                    <Button variant="primary" onClick={saveTripResource}>
                      {editingResourceIndex !== null ? "שמור שינויים" : "הוסף פריט"}
                    </Button>
                    {editingResourceIndex !== null ? <Button variant="ghost" onClick={() => deleteTripResource(editingResourceIndex)}>מחק</Button> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tripManagerType === "todo" ? (
              <div className="trip-manager-grid">
                <div className="trip-manager-list">
                  <section className="trip-manager-group">
                    <div className="trip-manager-group-head">
                      <strong>פתוחות</strong>
                      <span>{openTodos.length} משימות</span>
                    </div>
                    <div className="trip-manager-group-list">
                      {openTodos.length ? openTodos.map((todo) => (
                        <button key={todo.text} type="button" className={`trip-manager-item ${editingTodoText === todo.text ? "active" : ""}`} onClick={() => beginEditTodo(todo.text)}>
                          <strong>⏳ {todo.text}</strong>
                          <span>עדיין פתוח לסגירה</span>
                        </button>
                      )) : (
                        <div className="trip-manager-empty">אין כרגע משימות פתוחות.</div>
                      )}
                    </div>
                  </section>
                  <section className="trip-manager-group">
                    <div className="trip-manager-group-head">
                      <strong>סגורות</strong>
                      <span>{closedTodos.length} משימות</span>
                    </div>
                    <div className="trip-manager-group-list">
                      {closedTodos.length ? closedTodos.map((todo) => (
                        <button key={todo.text} type="button" className={`trip-manager-item ${editingTodoText === todo.text ? "active" : ""}`} onClick={() => beginEditTodo(todo.text)}>
                          <strong>✅ {todo.text}</strong>
                          <span>סומן כבוצע</span>
                        </button>
                      )) : (
                        <div className="trip-manager-empty">אין כרגע משימות סגורות.</div>
                      )}
                    </div>
                  </section>
                </div>
                <div className="trip-manager-panel">
                  <div className="trip-manager-panel-head">
                    <div>
                      <strong>{editingTodoText ? "עריכת משימה" : "הוספת משימה חדשה"}</strong>
                      <span>{editingTodoText ? "אפשר לעדכן טקסט, לסגור, לפתוח מחדש או למחוק." : "המשימה החדשה תתווסף ישירות לרשימת המשימות הפתוחות."}</span>
                    </div>
                    {editingTodoText ? <Button variant="ghost" size="sm" onClick={resetTodoEditor}>משימה חדשה</Button> : null}
                  </div>
                  <div className="day-modal-editor-grid">
                    <label className="day-modal-field">
                      <span>משימה</span>
                      <input
                        value={editingTodoText ? editingTodoValue : todoDraft}
                        onChange={(event) => editingTodoText ? setEditingTodoValue(event.target.value) : setTodoDraft(event.target.value)}
                        placeholder="למשל: להזמין כרטיסים"
                      />
                    </label>
                    <div className="day-modal-actions">
                      {editingTodoText ? (
                        <>
                          <Button variant="primary" onClick={saveTodoEdit}>שמור שינויים</Button>
                          <Button variant="ghost" onClick={() => toggleTodo(editingTodoText, Boolean(currentTripData.todos.find((todo) => todo.text === editingTodoText)?.done))}>
                            {currentTripData.todos.find((todo) => todo.text === editingTodoText)?.done ? "פתח מחדש" : "סמן כבוצע"}
                          </Button>
                          <Button variant="ghost" onClick={() => deleteTodo(editingTodoText)}>מחק</Button>
                        </>
                      ) : (
                        <Button variant="primary" onClick={addTodo}>הוסף משימה</Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
