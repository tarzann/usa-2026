import { buildTripDays, formatDate, type TripData, type TripDay, type TripUpdateAction } from "@/lib/trip";

export function inferTripUpdates(prompt: string, selectedDay: TripDay, currentTripData: TripData): TripUpdateAction[] {
  const text = prompt.trim();
  const normalized = text.toLowerCase();
  const quoted = text.match(/["“](.+?)["”]/)?.[1]?.trim() || text.match(/'(.+?)'/)?.[1]?.trim();

  if ((normalized.includes("הוסף") || normalized.includes("תוסיף") || normalized.includes("add")) && (normalized.includes("משימה") || normalized.includes("todo"))) {
    const todoText = quoted || text.split(":")[1]?.trim() || text.replace(/.*(?:משימה|todo)\s*/i, "").trim();
    return todoText ? [{ type: "add_todo", text: todoText }] : [];
  }

  if ((normalized.includes("סמן") || normalized.includes("תסמן") || normalized.includes("mark")) && (normalized.includes("בוצע") || normalized.includes("done") || normalized.includes("הושלם"))) {
    const todoText = quoted || findMatchingTodoText(text, currentTripData.todos.map((todo) => todo.text));
    return todoText ? [{ type: "complete_todo", text: todoText }] : [];
  }

  if ((normalized.includes("פתח") || normalized.includes("החזר") || normalized.includes("reopen")) && normalized.includes("משימ")) {
    const todoText = quoted || findMatchingTodoText(text, currentTripData.todos.map((todo) => todo.text));
    return todoText ? [{ type: "reopen_todo", text: todoText }] : [];
  }

  if ((normalized.includes("הוסף") || normalized.includes("תוסיף") || normalized.includes("add")) && (normalized.includes("אירוע") || normalized.includes("activity") || normalized.includes("אטרקציה"))) {
    const label = quoted || text.split(":")[1]?.trim();
    return label
      ? [{
          type: "add_event",
          date: selectedDay.date,
          label,
          details: `נוסף דרך Trip AI: ${label}`,
          emoji: "📍",
        }]
      : [];
  }

  if ((normalized.includes("שנה") || normalized.includes("עדכן")) && normalized.includes("כותרת")) {
    const title = quoted || text.split(":")[1]?.trim();
    return title ? [{ type: "update_day_title", date: selectedDay.date, title }] : [];
  }

  if ((normalized.includes("שנה") || normalized.includes("עדכן")) && (normalized.includes("סיכום") || normalized.includes("תיאור היום"))) {
    const summary = quoted || text.split(":")[1]?.trim();
    return summary ? [{ type: "update_day_summary", date: selectedDay.date, summary }] : [];
  }

  if ((normalized.includes("מחק") || normalized.includes("delete")) && normalized.includes("אירוע")) {
    const label = quoted || findMatchingEventLabel(text, selectedDay.events.map((event) => event.label));
    return label ? [{ type: "delete_event", date: selectedDay.date, label }] : [];
  }

  if ((normalized.includes("העבר") || normalized.includes("move")) && normalized.includes("אירוע")) {
    const label = quoted || findMatchingEventLabel(text, selectedDay.events.map((event) => event.label));
    if (!label) return [];

    if (normalized.includes("למחר") || normalized.includes("to tomorrow")) {
      const days = buildTripDays(currentTripData);
      const currentDayIndex = days.find((day) => day.date === selectedDay.date)?.index;
      const nextDay = typeof currentDayIndex === "number" ? days[currentDayIndex + 1] : null;
      return nextDay ? [{ type: "move_event", fromDate: selectedDay.date, toDate: nextDay.date, label }] : [];
    }

    const explicitDate = text.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0];
    return explicitDate ? [{ type: "move_event", fromDate: selectedDay.date, toDate: explicitDate, label }] : [];
  }

  if ((normalized.includes("עדכן") || normalized.includes("שנה")) && normalized.includes("אירוע")) {
    const label = quoted || findMatchingEventLabel(text, selectedDay.events.map((event) => event.label));
    const details = text.split(":")[1]?.trim();
    return label && details
      ? [{ type: "update_event", date: selectedDay.date, label, details }]
      : [];
  }

  if ((normalized.includes("עדכן") || normalized.includes("שנה")) && (normalized.includes("טיסה") || normalized.includes("flight"))) {
    const flight = resolveFlightTarget(text, selectedDay, currentTripData, quoted);
    const details = extractUpdatePayload(text);
    return flight && details
      ? [{ type: "update_flight", date: flight.date, label: flight.label, details }]
      : [];
  }

  if ((normalized.includes("עדכן") || normalized.includes("שנה")) && (normalized.includes("מלון") || normalized.includes("לינה") || normalized.includes("hotel"))) {
    const hotelName = quoted || findMatchingHotelName(text, currentTripData.hotels.map((hotel) => hotel.name));
    const details = text.split(":")[1]?.trim();
    if (!hotelName || !details) return [];

    return [{
      type: "update_hotel",
      name: hotelName,
      address: details,
    }];
  }

  if ((normalized.includes("הוסף") || normalized.includes("תוסיף") || normalized.includes("add")) && normalized.includes("יום")) {
    if (normalized.includes("מחר")) {
      const days = buildTripDays(currentTripData);
      const currentDayIndex = days.find((day) => day.date === selectedDay.date)?.index;
      const nextExistingDay = typeof currentDayIndex === "number" ? days[currentDayIndex + 1] : null;
      const targetDate = nextExistingDay ? shiftDate(nextExistingDay.date, -1) : shiftDate(selectedDay.date, 1);
      return [{ type: "add_day", date: targetDate }];
    }

    if (normalized.includes("אחרי")) {
      return [{ type: "add_day", date: shiftDate(selectedDay.date, 1) }];
    }

    if (normalized.includes("לפני")) {
      return [{ type: "add_day", date: shiftDate(selectedDay.date, -1) }];
    }

    const explicitDate = text.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0];
    return explicitDate ? [{ type: "add_day", date: explicitDate }] : [{ type: "add_day", date: shiftDate(selectedDay.date, 1) }];
  }

  if ((normalized.includes("מחק") || normalized.includes("הסר") || normalized.includes("delete") || normalized.includes("remove")) && normalized.includes("יום")) {
    if (normalized.includes("היום הזה") || normalized.includes("day") || normalized.includes("selected")) {
      return [{ type: "remove_day", date: selectedDay.date }];
    }

    const explicitDate = text.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0];
    return explicitDate ? [{ type: "remove_day", date: explicitDate }] : [{ type: "remove_day", date: selectedDay.date }];
  }

  return [];
}

export function buildImmediateUpdateReply(updates: TripUpdateAction[]) {
  const lines = updates.map((update) => {
    switch (update.type) {
      case "add_todo":
        return `הוספתי משימה חדשה: ${update.text}`;
      case "complete_todo":
        return `סימנתי את המשימה כבוצעה: ${update.text}`;
      case "reopen_todo":
        return `פתחתי מחדש את המשימה: ${update.text}`;
      case "add_event":
        return `הוספתי אירוע ל-${formatDate(update.date)}: ${update.label}`;
      case "update_day_title":
        return `עדכנתי את כותרת היום של ${formatDate(update.date)} ל-"${update.title}".`;
      case "update_day_summary":
        return `עדכנתי את סיכום היום של ${formatDate(update.date)}.`;
      case "update_event":
        return `עדכנתי את האירוע "${update.label}" ביום ${formatDate(update.date)}.`;
      case "delete_event":
        return `מחקתי את האירוע "${update.label}" מ-${formatDate(update.date)}.`;
      case "move_event":
        return `העברתי את האירוע "${update.label}" מ-${formatDate(update.fromDate)} ל-${formatDate(update.toDate)}.`;
      case "update_flight":
        return `עדכנתי את פרטי הטיסה "${update.label}" ליום ${formatDate(update.date)}.`;
      case "update_hotel":
        return `עדכנתי את פרטי הלינה "${update.name}".`;
      case "add_day":
        return `הוספתי יום למסלול בתאריך ${formatDate(update.date)}.`;
      case "remove_day":
        return `הסרתי את יום ${formatDate(update.date)} מהתצוגה של הטיול.`;
      default:
        return "בוצע עדכון במסלול.";
    }
  });

  return `${lines.join("\n")}\n\nהנתונים במסך עודכנו מיד.`;
}

function findMatchingTodoText(prompt: string, todos: string[]) {
  const normalizedPrompt = prompt.toLowerCase();
  return todos.find((todo) => normalizedPrompt.includes(todo.toLowerCase()));
}

function findMatchingEventLabel(prompt: string, events: string[]) {
  const normalizedPrompt = prompt.toLowerCase();
  return events.find((event) => normalizedPrompt.includes(event.toLowerCase()));
}

function findMatchingFlightLabel(prompt: string, flights: string[]) {
  const normalizedPrompt = prompt.toLowerCase();
  return flights.find((flight) => normalizedPrompt.includes(flight.toLowerCase()));
}

function findMatchingHotelName(prompt: string, hotels: string[]) {
  const normalizedPrompt = prompt.toLowerCase();
  return hotels.find((hotel) => normalizedPrompt.includes(hotel.toLowerCase()));
}

function shiftDate(dateStr: string, daysToAdd: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const current = new Date(year, month - 1, day);
  current.setDate(current.getDate() + daysToAdd);
  return [
    current.getFullYear(),
    String(current.getMonth() + 1).padStart(2, "0"),
    String(current.getDate()).padStart(2, "0"),
  ].join("-");
}

function resolveFlightTarget(prompt: string, selectedDay: TripDay, currentTripData: TripData, quoted?: string) {
  const normalized = prompt.toLowerCase();
  const flights = [...currentTripData.flights].sort((a, b) => a.date.localeCompare(b.date));

  if (quoted) {
    const quotedMatch = flights.find((flight) => flight.label === quoted || flight.label.toLowerCase() === quoted.toLowerCase());
    if (quotedMatch) return quotedMatch;
  }

  if (selectedDay.flights.length === 1) return selectedDay.flights[0];

  if (
    normalized.includes("יום האחרון") ||
    normalized.includes("טיסה אחרונה") ||
    normalized.includes("הטיסה האחרונה") ||
    normalized.includes("חזור") ||
    normalized.includes("return") ||
    normalized.includes("last flight")
  ) {
    return flights[flights.length - 1] ?? null;
  }

  if (
    normalized.includes("יום הראשון") ||
    normalized.includes("טיסה ראשונה") ||
    normalized.includes("הטיסה הראשונה") ||
    normalized.includes("הלוך") ||
    normalized.includes("outbound") ||
    normalized.includes("first flight")
  ) {
    return flights[0] ?? null;
  }

  const explicitLabel = findMatchingFlightLabel(prompt, flights.map((flight) => flight.label));
  if (explicitLabel) {
    return flights.find((flight) => flight.label === explicitLabel) ?? null;
  }

  return selectedDay.flights[0] ?? null;
}

function extractUpdatePayload(text: string) {
  const colonText = text.split(":").slice(1).join(":").trim();
  if (colonText) return colonText;

  const dashText = text.split(" - ").slice(1).join(" - ").trim();
  if (dashText) return dashText;

  return "";
}
