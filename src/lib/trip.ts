import tripDataJson from "@/data/trip-data.json";

export type Flight = {
  date: string;
  label: string;
  details: string;
  booking?: string;
  confirmation?: string;
  airline?: string;
  from?: string;
  to?: string;
  stops?: string[];
  departureDate?: string;
  departureTime?: string;
  arrivalDate?: string;
  arrivalTime?: string;
};

export type Segment = {
  id: string;
  label: string;
  color: string;
  bg: string;
  text: string;
  startDate: string;
  endDate: string;
};

export type EventItem = {
  date: string;
  emoji: string;
  label: string;
  details: string;
  locked?: boolean;
  segmentId?: string;
};

export type Hotel = {
  name: string;
  location: string;
  checkIn: string;
  checkOut: string;
  address: string;
  phone?: string;
  confirmation?: string;
};

export type Todo = {
  text: string;
  done: boolean;
};

export type UploadedAsset = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
  contentType: string;
  name: string;
};

export type TripResource = {
  title: string;
  content?: string;
  url?: string;
  file?: UploadedAsset;
};

export type DestinationHero = {
  url?: string;
  file?: UploadedAsset;
};

export type DayLocationOverride = {
  name: string;
  region?: string;
  lat?: number;
  lng?: number;
};

export type DayCar = {
  startDate?: string;
  endDate?: string;
  provider?: string;
  pickup?: string;
  dropoff?: string;
  confirmation?: string;
  notes?: string;
};

export type DayOverride = {
  title?: string;
  summary?: string | null;
  location?: DayLocationOverride | null;
  car?: DayCar | null;
  travelMode?: string;
};

export type TripData = {
  title: string;
  participants: string[];
  startDate: string;
  endDate: string;
  flights: Flight[];
  segments: Segment[];
  events: EventItem[];
  hotels: Hotel[];
  cars?: DayCar[];
  resources?: TripResource[];
  destinationHeroes?: Record<string, DestinationHero>;
  todos: Todo[];
  dayOverrides?: Record<string, DayOverride>;
  skippedDates?: string[];
};

export type TripUpdateAction =
  | { type: "add_todo"; text: string }
  | { type: "complete_todo"; text: string }
  | { type: "reopen_todo"; text: string }
  | { type: "add_event"; date: string; label: string; details: string; emoji?: string; locked?: boolean }
  | { type: "update_day_title"; date: string; title: string }
  | { type: "update_day_summary"; date: string; summary: string }
  | { type: "update_event"; date: string; label: string; nextLabel?: string; details?: string; emoji?: string; locked?: boolean }
  | { type: "delete_event"; date: string; label: string }
  | { type: "move_event"; fromDate: string; toDate: string; label: string }
  | {
      type: "add_flight";
      date: string;
      label: string;
      details: string;
      booking?: string;
      confirmation?: string;
      airline?: string;
      from?: string;
      to?: string;
      stops?: string[];
      departureDate?: string;
      departureTime?: string;
      arrivalDate?: string;
      arrivalTime?: string;
    }
  | {
      type: "update_flight";
      date: string;
      label: string;
      nextDate?: string;
      nextLabel?: string;
      details?: string;
      booking?: string;
      confirmation?: string;
      airline?: string;
      from?: string;
      to?: string;
      stops?: string[];
      departureDate?: string;
      departureTime?: string;
      arrivalDate?: string;
      arrivalTime?: string;
    }
  | { type: "delete_flight"; date: string; label: string }
  | { type: "add_hotel"; name: string; location: string; checkIn: string; checkOut: string; address: string; phone?: string; confirmation?: string }
  | { type: "update_hotel"; name: string; nextName?: string; address?: string; phone?: string; confirmation?: string; location?: string }
  | { type: "delete_hotel"; name: string; checkIn: string }
  | { type: "update_location"; date: string; name: string; region?: string; lat?: number; lng?: number }
  | { type: "clear_location"; date: string }
  | { type: "update_car"; date: string; startDate?: string; endDate?: string; provider?: string; pickup?: string; dropoff?: string; confirmation?: string; notes?: string }
  | { type: "clear_car"; date: string }
  | { type: "clear_day_summary"; date: string }
  | { type: "swap_day_content"; fromDate: string; toDate: string }
  | { type: "add_day"; date: string }
  | { type: "remove_day"; date: string };

export type TripLocation = {
  name: string;
  lat: number;
  lng: number;
  region: string;
};

export type TripDay = {
  index: number;
  date: string;
  dayName: string;
  monthLabel: string;
  dayNum: number;
  title: string;
  summary: string;
  flights: Flight[];
  events: EventItem[];
  hotels: Hotel[];
  car: DayCar | null;
  segment: Segment | null;
  location: TripLocation;
  pendingTodos: Todo[];
  travelMode: string;
};

const MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const DOW_NAMES = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];

const LOCATION_LOOKUP: Record<string, TripLocation> = {
  ny: { name: "ניו יורק", lat: 40.7128, lng: -74.006, region: "Northeast" },
  dc: { name: "וושינגטון DC", lat: 38.9072, lng: -77.0369, region: "Capital" },
  road: { name: "הכביש המזרחי", lat: 35.7, lng: -77.6, region: "Road Trip" },
  orlando: { name: "אורלנדו", lat: 28.5383, lng: -81.3792, region: "Florida" },
  appalachia: { name: "Appalachia", lat: 35.5951, lng: -82.5515, region: "Mountains" },
  norfolk: { name: "Norfolk", lat: 36.8508, lng: -76.2859, region: "Virginia" },
  outer_banks: { name: "Outer Banks", lat: 35.5582, lng: -75.4665, region: "North Carolina" },
  beaufort: { name: "Beaufort", lat: 34.7182, lng: -76.6638, region: "North Carolina" },
  charleston: { name: "Charleston", lat: 32.7765, lng: -79.9311, region: "South Carolina" },
  savannah: { name: "Savannah", lat: 32.0809, lng: -81.0912, region: "Georgia" },
  kennedy: { name: "Kennedy Space Center", lat: 28.5729, lng: -80.649, region: "Florida" },
  miami: { name: "Miami", lat: 25.7617, lng: -80.1918, region: "Florida" },
};

export const tripData = sanitizeTripData(tripDataJson as TripData);

export function sanitizeTripData(data: TripData): TripData {
  return {
    ...data,
    events: data.events.filter((event) => isDateInTrip(event.date, data)),
    segments: data.segments.filter((segment) => segment.endDate >= data.startDate && segment.startDate <= data.endDate),
    cars: (data.cars ?? []).filter((car) => {
      const startDate = car.startDate ?? data.startDate;
      const endDate = car.endDate ?? startDate;
      return endDate >= data.startDate && startDate <= data.endDate;
    }),
    resources: data.resources ?? [],
    destinationHeroes: data.destinationHeroes ?? {},
    dayOverrides: data.dayOverrides ?? {},
    skippedDates: (data.skippedDates ?? []).filter((date) => isDateInTrip(date, data)),
  };
}

export function applyTripUpdates(data: TripData, updates: TripUpdateAction[]) {
  const nextData: TripData = {
    ...data,
    flights: [...data.flights],
    segments: [...data.segments],
    events: [...data.events],
    hotels: [...data.hotels],
    cars: (data.cars ?? []).map((car) => ({ ...car })),
    resources: (data.resources ?? []).map((resource) => ({
      ...resource,
      file: resource.file ? { ...resource.file } : undefined,
    })),
    destinationHeroes: Object.fromEntries(
      Object.entries(data.destinationHeroes ?? {}).map(([key, value]) => [
        key,
        {
          ...value,
          file: value.file ? { ...value.file } : undefined,
        },
      ]),
    ),
    todos: data.todos.map((todo) => ({ ...todo })),
    dayOverrides: { ...(data.dayOverrides ?? {}) },
    skippedDates: [...(data.skippedDates ?? [])],
  };
  const dayOverrides = nextData.dayOverrides ?? {};
  nextData.dayOverrides = dayOverrides;
  const skippedDates = new Set(nextData.skippedDates ?? []);
  nextData.skippedDates = [...skippedDates];

  for (const update of updates) {
    switch (update.type) {
      case "add_todo": {
        const text = update.text.trim();
        if (!text) break;
        if (nextData.todos.some((todo) => todo.text.trim().toLowerCase() === text.toLowerCase())) break;
        nextData.todos.unshift({ text, done: false });
        break;
      }
      case "complete_todo": {
        const match = nextData.todos.find((todo) => todo.text.trim().toLowerCase() === update.text.trim().toLowerCase());
        if (match) match.done = true;
        break;
      }
      case "reopen_todo": {
        const match = nextData.todos.find((todo) => todo.text.trim().toLowerCase() === update.text.trim().toLowerCase());
        if (match) match.done = false;
        break;
      }
      case "add_event": {
        if (!update.label.trim() || !update.details.trim()) break;
        nextData.events.push({
          date: update.date,
          emoji: update.emoji?.trim() || "📍",
          label: update.label.trim(),
          details: update.details.trim(),
          locked: update.locked,
        });
        break;
      }
      case "update_day_title": {
        const title = update.title.trim();
        if (!title) break;
        dayOverrides[update.date] = {
          ...(dayOverrides[update.date] ?? {}),
          title,
        };
        break;
      }
      case "update_day_summary": {
        const summary = update.summary.trim();
        if (!summary) break;
        dayOverrides[update.date] = {
          ...(dayOverrides[update.date] ?? {}),
          summary,
        };
        break;
      }
      case "clear_day_summary": {
        dayOverrides[update.date] = {
          ...(dayOverrides[update.date] ?? {}),
          summary: null,
        };
        break;
      }
      case "swap_day_content": {
        const { fromDate, toDate } = update;
        if (fromDate === toDate) break;

        nextData.events = nextData.events.map((event) => {
          if (event.date === fromDate) return { ...event, date: toDate };
          if (event.date === toDate) return { ...event, date: fromDate };
          return event;
        });

        nextData.flights = nextData.flights.map((flight) => {
          if (flight.date === fromDate) return { ...flight, date: toDate };
          if (flight.date === toDate) return { ...flight, date: fromDate };
          return flight;
        });

        const fromOverride = cloneDayOverride(dayOverrides[fromDate]);
        const toOverride = cloneDayOverride(dayOverrides[toDate]);

        if (toOverride) {
          dayOverrides[fromDate] = toOverride;
        } else {
          delete dayOverrides[fromDate];
        }

        if (fromOverride) {
          dayOverrides[toDate] = fromOverride;
        } else {
          delete dayOverrides[toDate];
        }
        break;
      }
      case "update_event": {
        const match = nextData.events.find(
          (event) =>
            event.date === update.date &&
            event.label.trim().toLowerCase() === update.label.trim().toLowerCase(),
        );
        if (!match) break;
        if (update.nextLabel?.trim()) match.label = update.nextLabel.trim();
        if (update.details?.trim()) match.details = update.details.trim();
        if (update.emoji?.trim()) match.emoji = update.emoji.trim();
        if (typeof update.locked === "boolean") match.locked = update.locked;
        break;
      }
      case "delete_event": {
        nextData.events = nextData.events.filter(
          (event) =>
            !(event.date === update.date && event.label.trim().toLowerCase() === update.label.trim().toLowerCase()),
        );
        break;
      }
      case "move_event": {
        const match = nextData.events.find(
          (event) =>
            event.date === update.fromDate &&
            event.label.trim().toLowerCase() === update.label.trim().toLowerCase(),
        );
        if (match) match.date = update.toDate;
        break;
      }
      case "add_flight": {
        if (!update.label.trim() || !update.details.trim()) break;
        nextData.flights.push({
          date: update.date,
          label: update.label.trim(),
          details: update.details.trim(),
          booking: update.booking?.trim() || undefined,
          confirmation: update.confirmation?.trim() || update.booking?.trim() || undefined,
          airline: update.airline?.trim() || undefined,
          from: update.from?.trim() || undefined,
          to: update.to?.trim() || undefined,
          stops: update.stops?.map((stop) => stop.trim()).filter(Boolean) || undefined,
          departureDate: update.departureDate?.trim() || undefined,
          departureTime: update.departureTime?.trim() || undefined,
          arrivalDate: update.arrivalDate?.trim() || undefined,
          arrivalTime: update.arrivalTime?.trim() || undefined,
        });
        break;
      }
      case "update_flight": {
        const match = nextData.flights.find(
          (flight) =>
            flight.date === update.date &&
            flight.label.trim().toLowerCase() === update.label.trim().toLowerCase(),
        );
        if (!match) break;
        if (update.nextDate?.trim()) {
          match.date = update.nextDate.trim();
          if (match.date < nextData.startDate) nextData.startDate = match.date;
          if (match.date > nextData.endDate) nextData.endDate = match.date;
        }
        if (update.nextLabel?.trim()) match.label = update.nextLabel.trim();
        if (update.details?.trim()) match.details = update.details.trim();
        if (update.booking?.trim()) match.booking = update.booking.trim();
        if (update.confirmation?.trim()) match.confirmation = update.confirmation.trim();
        if (update.airline !== undefined) match.airline = update.airline?.trim() || undefined;
        if (update.from !== undefined) match.from = update.from?.trim() || undefined;
        if (update.to !== undefined) match.to = update.to?.trim() || undefined;
        if (update.stops !== undefined) match.stops = update.stops.map((stop) => stop.trim()).filter(Boolean);
        if (update.departureDate !== undefined) match.departureDate = update.departureDate?.trim() || undefined;
        if (update.departureTime !== undefined) match.departureTime = update.departureTime?.trim() || undefined;
        if (update.arrivalDate !== undefined) match.arrivalDate = update.arrivalDate?.trim() || undefined;
        if (update.arrivalTime !== undefined) match.arrivalTime = update.arrivalTime?.trim() || undefined;
        break;
      }
      case "delete_flight": {
        nextData.flights = nextData.flights.filter(
          (flight) =>
            !(flight.date === update.date && flight.label.trim().toLowerCase() === update.label.trim().toLowerCase()),
        );
        break;
      }
      case "add_hotel": {
        if (!update.name.trim() || !update.address.trim()) break;
        nextData.hotels.push({
          name: update.name.trim(),
          location: update.location.trim(),
          checkIn: update.checkIn,
          checkOut: update.checkOut,
          address: update.address.trim(),
          phone: update.phone?.trim() || undefined,
          confirmation: update.confirmation?.trim() || undefined,
        });
        break;
      }
      case "update_hotel": {
        const match = nextData.hotels.find(
          (hotel) => hotel.name.trim().toLowerCase() === update.name.trim().toLowerCase(),
        );
        if (!match) break;
        if (update.nextName?.trim()) match.name = update.nextName.trim();
        if (update.address?.trim()) match.address = update.address.trim();
        if (update.phone?.trim()) match.phone = update.phone.trim();
        if (update.confirmation?.trim()) match.confirmation = update.confirmation.trim();
        if (update.location?.trim()) match.location = update.location.trim();
        break;
      }
      case "delete_hotel": {
        nextData.hotels = nextData.hotels.filter(
          (hotel) =>
            !(hotel.checkIn === update.checkIn && hotel.name.trim().toLowerCase() === update.name.trim().toLowerCase()),
        );
        break;
      }
      case "update_location": {
        dayOverrides[update.date] = {
          ...(dayOverrides[update.date] ?? {}),
          location: {
            name: update.name.trim(),
            region: update.region?.trim() || undefined,
            lat: typeof update.lat === "number" ? update.lat : undefined,
            lng: typeof update.lng === "number" ? update.lng : undefined,
          },
        };
        break;
      }
      case "clear_location": {
        dayOverrides[update.date] = {
          ...(dayOverrides[update.date] ?? {}),
          location: null,
        };
        break;
      }
      case "update_car": {
        const startDate = update.startDate?.trim() || update.date;
        const endDate = update.endDate?.trim() || startDate;
        const cars = nextData.cars ?? [];
        nextData.cars = cars;
        const matchIndex = cars.findIndex((car) =>
          (update.confirmation?.trim() && car.confirmation?.trim() === update.confirmation.trim()) ||
          ((car.startDate ?? update.date) <= update.date && (car.endDate ?? car.startDate ?? update.date) >= update.date),
        );
        const nextCar: DayCar = {
          startDate,
          endDate,
          provider: update.provider?.trim() || undefined,
          pickup: update.pickup?.trim() || undefined,
          dropoff: update.dropoff?.trim() || undefined,
          confirmation: update.confirmation?.trim() || undefined,
          notes: update.notes?.trim() || undefined,
        };
        if (matchIndex >= 0) cars[matchIndex] = nextCar;
        else cars.push(nextCar);
        break;
      }
      case "clear_car": {
        nextData.cars = (nextData.cars ?? []).filter((car) => {
          const startDate = car.startDate ?? update.date;
          const endDate = car.endDate ?? startDate;
          return !(startDate <= update.date && endDate >= update.date);
        });
        dayOverrides[update.date] = {
          ...(dayOverrides[update.date] ?? {}),
          car: null,
          travelMode: undefined,
        };
        break;
      }
      case "add_day": {
        if (update.date < nextData.startDate) nextData.startDate = update.date;
        if (update.date > nextData.endDate) nextData.endDate = update.date;
        skippedDates.delete(update.date);
        nextData.skippedDates = [...skippedDates].sort();
        break;
      }
      case "remove_day": {
        if (update.date < nextData.startDate || update.date > nextData.endDate) break;
        skippedDates.add(update.date);
        nextData.skippedDates = [...skippedDates].sort();
        break;
      }
    }
  }

  return sanitizeTripData(nextData);
}

function cloneDayOverride(override: DayOverride | undefined) {
  if (!override) return undefined;

  return {
    ...override,
    location: override.location ? { ...override.location } : override.location,
    car: override.car ? { ...override.car } : override.car,
  };
}

export function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

export function dateRange(start: string, end: string) {
  const dates: string[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const current = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);

  while (current <= last) {
    dates.push([
      current.getFullYear(),
      String(current.getMonth() + 1).padStart(2, "0"),
      String(current.getDate()).padStart(2, "0"),
    ].join("-"));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function isDateInTrip(dateStr: string, data: TripData) {
  return dateStr >= data.startDate && dateStr <= data.endDate;
}

function getEventsForDate(dateStr: string, data: TripData) {
  return data.events.filter((event) => event.date === dateStr);
}

function getFlightsForDate(dateStr: string, data: TripData) {
  return data.flights.filter((flight) => flight.date === dateStr);
}

function getHotelsForDate(dateStr: string, data: TripData) {
  return data.hotels.filter((hotel) => hotel.checkIn <= dateStr && hotel.checkOut > dateStr);
}

function getCarForDate(dateStr: string, data: TripData) {
  const rangedCar = (data.cars ?? []).find((car) => {
    const startDate = car.startDate ?? dateStr;
    const endDate = car.endDate ?? startDate;
    return startDate <= dateStr && endDate >= dateStr;
  });
  if (rangedCar) return rangedCar;
  return data.dayOverrides?.[dateStr]?.car ?? null;
}

function getSegmentById(segmentId: string | undefined, data: TripData) {
  return data.segments.find((segment) => segment.id === segmentId) ?? null;
}

function getSegmentForDate(dateStr: string, data: TripData) {
  const fromEvents = getEventsForDate(dateStr, data).find((event) => event.segmentId);
  if (fromEvents) {
    return getSegmentById(fromEvents.segmentId, data);
  }

  return data.segments.find(
    (segment) => dateStr >= segment.startDate && dateStr <= segment.endDate,
  ) ?? null;
}

function buildDayTitle(dateStr: string, flights: Flight[], events: EventItem[], segment: Segment | null, data: TripData) {
  const overrideTitle = data.dayOverrides?.[dateStr]?.title?.trim();
  if (overrideTitle) return overrideTitle;

  if (flights.length > 0) {
    if (dateStr === data.startDate) return "טיסה מתל אביב לניו יורק";
    if (dateStr === data.endDate) return "טיסת חזרה ממיאמי לתל אביב";
    return flights[0].label;
  }

  if (events.length > 0) return events[0].label;
  if (segment) return `יום ב${segment.label.replace(/^[^\s]+\s*/, "")}`;
  return "יום חופשי לתכנון";
}

function buildDaySummary(_flights: Flight[], events: EventItem[]) {
  if (events.length > 0) return events.map((event) => event.details.split("|")[0].trim()).join(" · ");
  return "";
}

function buildDaySummaryWithOverrides(dateStr: string, flights: Flight[], events: EventItem[], hotels: Hotel[], data: TripData) {
  const override = data.dayOverrides?.[dateStr];
  if (override && Object.prototype.hasOwnProperty.call(override, "summary")) {
    const rawSummary = override.summary;
    if (rawSummary === null) return "";
    if (typeof rawSummary === "string") return rawSummary.trim();
  }
  return buildDaySummary(flights, events);
}

function detectTravelMode(dateStr: string, title: string, summary: string, data: TripData) {
  const overrideMode = data.dayOverrides?.[dateStr]?.travelMode?.trim();
  if (overrideMode) return overrideMode;
  if (getFlightsForDate(dateStr, data).length > 0) return "טיסה";
  if (getCarForDate(dateStr, data)) return "רכב / דרך";
  const text = `${title} ${summary}`;
  if (text.includes("רכבת") || text.includes("Amtrak")) return "רכבת";
  if (text.includes("Drive") || text.includes("Road") || text.includes("נסיעה") || text.includes("מעבורת")) return "רכב / דרך";
  return "יום יעד";
}

function getDayLocation(dateStr: string, title: string, summary: string, segment: Segment | null, data: TripData) {
  const override = data.dayOverrides?.[dateStr]?.location;
  const text = `${title} ${summary}`.toLowerCase();
  let fallback = LOCATION_LOOKUP.orlando;
  if (text.includes("kennedy")) fallback = LOCATION_LOOKUP.kennedy;
  else if (text.includes("miami")) fallback = LOCATION_LOOKUP.miami;
  else if (text.includes("norfolk") || text.includes("cape charles")) fallback = LOCATION_LOOKUP.norfolk;
  else if (text.includes("outer banks") || text.includes("ocracoke")) fallback = LOCATION_LOOKUP.outer_banks;
  else if (text.includes("beaufort")) fallback = LOCATION_LOOKUP.beaufort;
  else if (text.includes("charleston")) fallback = LOCATION_LOOKUP.charleston;
  else if (text.includes("savannah")) fallback = LOCATION_LOOKUP.savannah;
  if (segment && LOCATION_LOOKUP[segment.id]) fallback = LOCATION_LOOKUP[segment.id];

  if (!override?.name?.trim()) return fallback;

  return {
    name: override.name.trim(),
    region: override.region?.trim() || fallback.region,
    lat: typeof override.lat === "number" ? override.lat : fallback.lat,
    lng: typeof override.lng === "number" ? override.lng : fallback.lng,
  };
}

export function buildTripDays(data: TripData = tripData) {
  const skippedDates = new Set(data.skippedDates ?? []);
  return dateRange(data.startDate, data.endDate).filter((dateStr) => !skippedDates.has(dateStr)).map((dateStr, index): TripDay => {
    const flights = getFlightsForDate(dateStr, data);
    const events = getEventsForDate(dateStr, data);
    const hotels = getHotelsForDate(dateStr, data);
    const car = getCarForDate(dateStr, data);
    const segment = getSegmentForDate(dateStr, data);
    const title = buildDayTitle(dateStr, flights, events, segment, data);
    const summary = buildDaySummaryWithOverrides(dateStr, flights, events, hotels, data);
    const location = getDayLocation(dateStr, title, summary, segment, data);
    const pendingTodos = data.todos
      .filter((todo) => {
        if (todo.done) return false;
        const segmentName = segment ? segment.label.replace(/^[^\s]+\s*/, "").toLowerCase() : "";
        const todoText = todo.text.toLowerCase();
        return (
          (segmentName && todoText.includes(segmentName)) ||
          (segment && todoText.includes(segment.id.toLowerCase())) ||
          (summary.toLowerCase().includes("disney") && todoText.includes("disney")) ||
          (summary.toLowerCase().includes("universal") && todoText.includes("universal"))
        );
      })
      .slice(0, 4);

    const [year, month, day] = dateStr.split("-").map(Number);

    return {
      index,
      date: dateStr,
      dayName: DOW_NAMES[new Date(year, month - 1, day).getDay()],
      monthLabel: MONTH_NAMES[month - 1],
      dayNum: day,
      title,
      summary,
      flights,
      events,
      hotels,
      car,
      segment,
      location,
      pendingTodos,
      travelMode: detectTravelMode(dateStr, title, summary, data),
    };
  });
}

export function getProgressRatio(data: TripData = tripData) {
  if (!data.todos.length) return 1;
  return data.todos.filter((todo) => todo.done).length / data.todos.length;
}

export function countLockedItems(data: TripData = tripData) {
  return data.flights.length + data.hotels.length + (data.cars ?? []).length + Object.values(data.dayOverrides ?? {}).filter((item) => item.car).length + data.events.filter((event) => event.locked).length;
}

export function countTransportDays(days: TripDay[]) {
  return days.filter((day) => day.travelMode !== "יום יעד").length;
}

export function buildAiAnswer(prompt: string, selectedDay: TripDay, days: TripDay[], data: TripData = tripData) {
  const normalized = prompt.toLowerCase();
  const nextDay = days[selectedDay.index + 1];
  const openTodos = data.todos.filter((todo) => !todo.done);
  const busiestDay = [...days].sort((a, b) => (b.events.length + b.flights.length) - (a.events.length + a.flights.length))[0];

  if (normalized.includes("מחר") || normalized.includes("tomorrow")) {
    if (!nextDay) return `מחר כבר אין מסלול פעיל כי ${selectedDay.title} הוא היום האחרון בטיול.`;
    return `מחר הוא ${nextDay.dayName} (${formatDate(nextDay.date)}): ${nextDay.title}.\nמיקום: ${nextDay.location.name}.\nפוקוס תפעולי: ${nextDay.summary}\nמשימות פתוחות קשורות: ${nextDay.pendingTodos.length ? nextDay.pendingTodos.map((todo) => todo.text).join(" | ") : "אין כרגע משהו דחוף."}`;
  }

  if (normalized.includes("חסר") || normalized.includes("פתוח") || normalized.includes("booking") || normalized.includes("הזמנ")) {
    return `כרגע יש ${openTodos.length} משימות פתוחות במסלול.\nליום שנבחר בולטים: ${selectedDay.pendingTodos.length ? selectedDay.pendingTodos.map((todo) => todo.text).join(" | ") : "אין משימות ישירות ליום הזה."}\nברמת המאקרו עדיין חסרות סגירות סביב לינות, כרטיסים לפארקים והשכרת רכב.`;
  }

  if (normalized.includes("עומס") || normalized.includes("busy") || normalized.includes("איזון")) {
    return `היום העמוס ביותר כרגע נראה כמו ${formatDate(busiestDay.date)} עם הכותרת "${busiestDay.title}".\nיש בו ${busiestDay.events.length + busiestDay.flights.length} עוגנים.\nהמלצה מוצרית: לזהות אילו חלקים נעולים ואילו גמישים, ואז להציע ל-AI לחלק את היום לבוקר / צהריים / ערב עם מרווחי נסיעה.`;
  }

  if (normalized.includes("היום") || normalized.includes("יום הזה") || normalized.includes("selected")) {
    return `היום שנבחר הוא ${formatDate(selectedDay.date)}: ${selectedDay.title}.\nהוא מתרחש ב-${selectedDay.location.name} ושייך ל-${selectedDay.segment ? selectedDay.segment.label : "יום פתוח"}.\nאם נרצה להפוך אותו לחכם יותר, הצעד הבא הוא להוסיף לו חלונות זמן, עלות, תחבורה וזמני הזמנה.`;
  }

  return `סיכום מהיר למסלול:\nהטיול בנוי על ${days.length} ימים, עם מוקדים בניו יורק, וושינגטון, כביש החוף המזרחי ואורלנדו/פלורידה.\nהיום שנבחר כרגע הוא "${selectedDay.title}" ב-${selectedDay.location.name}.\nאם נמשיך לפיתוח מלא, הייתי מוסיף שכבת AI שמעדכנת אוטומטית timeline, map ו-day details מתוך השיחה עם המשתמש.`;
}
