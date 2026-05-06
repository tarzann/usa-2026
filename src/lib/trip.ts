import tripDataJson from "@/data/trip-data.json";

export type Flight = {
  date: string;
  label: string;
  details: string;
  booking?: string;
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

export type TripData = {
  title: string;
  participants: string[];
  startDate: string;
  endDate: string;
  flights: Flight[];
  segments: Segment[];
  events: EventItem[];
  hotels: Hotel[];
  todos: Todo[];
};

export type TripUpdateAction =
  | { type: "add_todo"; text: string }
  | { type: "complete_todo"; text: string }
  | { type: "reopen_todo"; text: string }
  | { type: "add_event"; date: string; label: string; details: string; emoji?: string; locked?: boolean };

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
  };
}

export function applyTripUpdates(data: TripData, updates: TripUpdateAction[]) {
  const nextData: TripData = {
    ...data,
    flights: [...data.flights],
    segments: [...data.segments],
    events: [...data.events],
    hotels: [...data.hotels],
    todos: data.todos.map((todo) => ({ ...todo })),
  };

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
    }
  }

  return sanitizeTripData(nextData);
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
  if (flights.length > 0) {
    if (dateStr === data.startDate) return "טיסה מתל אביב לניו יורק";
    if (dateStr === data.endDate) return "טיסת חזרה ממיאמי לתל אביב";
    return flights[0].label;
  }

  if (events.length > 0) return events[0].label;
  if (segment) return `יום ב${segment.label.replace(/^[^\s]+\s*/, "")}`;
  return "יום חופשי לתכנון";
}

function buildDaySummary(flights: Flight[], events: EventItem[], hotels: Hotel[]) {
  if (flights.length > 0) return flights[0].details.replace(/\s*\|\s*/g, " · ");
  if (events.length > 0) return events.map((event) => event.details.split("|")[0].trim()).join(" · ");
  if (hotels.length > 0) return `יום רגוע באזור ${hotels[0].location} עם לינה ב-${hotels[0].name}.`;
  return "אין עדיין תכנון קשיח ליום הזה, וזה מקום טוב ל-AI להציע אופטימיזציה.";
}

function detectTravelMode(title: string, summary: string) {
  const text = `${title} ${summary}`;
  if (text.includes("טיסה") || text.includes("JFK") || text.includes("MIA")) return "טיסה";
  if (text.includes("רכבת") || text.includes("Amtrak")) return "רכבת";
  if (text.includes("Drive") || text.includes("Road") || text.includes("נסיעה") || text.includes("מעבורת")) return "רכב / דרך";
  return "יום יעד";
}

function getDayLocation(title: string, summary: string, segment: Segment | null) {
  const text = `${title} ${summary}`.toLowerCase();
  if (text.includes("kennedy")) return LOCATION_LOOKUP.kennedy;
  if (text.includes("miami")) return LOCATION_LOOKUP.miami;
  if (text.includes("norfolk") || text.includes("cape charles")) return LOCATION_LOOKUP.norfolk;
  if (text.includes("outer banks") || text.includes("ocracoke")) return LOCATION_LOOKUP.outer_banks;
  if (text.includes("beaufort")) return LOCATION_LOOKUP.beaufort;
  if (text.includes("charleston")) return LOCATION_LOOKUP.charleston;
  if (text.includes("savannah")) return LOCATION_LOOKUP.savannah;
  if (segment && LOCATION_LOOKUP[segment.id]) return LOCATION_LOOKUP[segment.id];
  return LOCATION_LOOKUP.orlando;
}

export function buildTripDays(data: TripData = tripData) {
  return dateRange(data.startDate, data.endDate).map((dateStr, index): TripDay => {
    const flights = getFlightsForDate(dateStr, data);
    const events = getEventsForDate(dateStr, data);
    const hotels = getHotelsForDate(dateStr, data);
    const segment = getSegmentForDate(dateStr, data);
    const title = buildDayTitle(dateStr, flights, events, segment, data);
    const summary = buildDaySummary(flights, events, hotels);
    const location = getDayLocation(title, summary, segment);
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
      segment,
      location,
      pendingTodos,
      travelMode: detectTravelMode(title, summary),
    };
  });
}

export function getProgressRatio(data: TripData = tripData) {
  if (!data.todos.length) return 1;
  return data.todos.filter((todo) => todo.done).length / data.todos.length;
}

export function countLockedItems(data: TripData = tripData) {
  return data.flights.length + data.hotels.length + data.events.filter((event) => event.locked).length;
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
