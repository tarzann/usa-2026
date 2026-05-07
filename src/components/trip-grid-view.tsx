"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  applyTripUpdates,
  buildTripDays,
  formatDate,
  sanitizeTripData,
  type DayCar,
  type Flight,
  type Hotel,
  type TripData,
  type TripDay,
  type TripUpdateAction,
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
  provider: string;
  pickup: string;
  dropoff: string;
  confirmation: string;
  notes: string;
};

type DayFlightForm = {
  label: string;
  details: string;
  booking: string;
};

type DayHotelForm = {
  name: string;
  location: string;
  address: string;
  phone: string;
  confirmation: string;
  checkOut: string;
};

type GridEditTab = "general" | "location" | "flight" | "hotel" | "car";

const LOCAL_STORAGE_KEY = "trip-planner-data-v1";
const gridEditTabs: Array<{ id: GridEditTab; label: string; emoji: string }> = [
  { id: "general", label: "יום", emoji: "🗓️" },
  { id: "location", label: "מיקום", emoji: "📍" },
  { id: "flight", label: "טיסה", emoji: "✈️" },
  { id: "hotel", label: "מלון", emoji: "🏨" },
  { id: "car", label: "רכב", emoji: "🚗" },
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
    provider: car?.provider || "",
    pickup: car?.pickup || "",
    dropoff: car?.dropoff || "",
    confirmation: car?.confirmation || "",
    notes: car?.notes || "",
  };
}

function buildFlightForm(flight: Flight | undefined): DayFlightForm {
  return {
    label: flight?.label || "",
    details: flight?.details || "",
    booking: flight?.booking || "",
  };
}

function buildHotelForm(hotel: Hotel | undefined, date: string): DayHotelForm {
  return {
    name: hotel?.name || "",
    location: hotel?.location || "",
    address: hotel?.address || "",
    phone: hotel?.phone || "",
    confirmation: hotel?.confirmation || "",
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
  const [activeEditTab, setActiveEditTab] = useState<GridEditTab>("general");
  const [titleForm, setTitleForm] = useState("");
  const [summaryForm, setSummaryForm] = useState("");
  const [planForm, setPlanForm] = useState("");
  const [locationForm, setLocationForm] = useState<DayLocationForm>({ name: "", region: "", lat: "", lng: "" });
  const [carForm, setCarForm] = useState<DayCarForm>({ provider: "", pickup: "", dropoff: "", confirmation: "", notes: "" });
  const [flightForm, setFlightForm] = useState<DayFlightForm>({ label: "", details: "", booking: "" });
  const [hotelForm, setHotelForm] = useState<DayHotelForm>({ name: "", location: "", address: "", phone: "", confirmation: "", checkOut: "" });

  const days = useMemo(() => buildTripDays(currentTripData), [currentTripData]);
  const locationTagStyles = useMemo(
    () => buildLocationTagStyles(days.map((day) => day.location.name)),
    [days],
  );
  const activeDay = openDate ? days.find((day) => day.date === openDate) ?? null : null;

  function closeModal() {
    setOpenDate(null);
    setAttachments([]);
    setAttachmentsLoading(false);
    setActiveEditTab("general");
  }

  function syncEditorState(day: TripDay, tripData: TripData) {
    const overrideTitle = tripData.dayOverrides?.[day.date]?.title?.trim();
    const overrideSummary = tripData.dayOverrides?.[day.date]?.summary?.trim();
    setTitleForm(overrideTitle || day.title);
    setSummaryForm(overrideSummary || day.summary);
    setLocationForm(buildLocationForm(day, tripData));
    setCarForm(buildCarForm(day.car));
    setFlightForm(buildFlightForm(day.flights[0]));
    setHotelForm(buildHotelForm(day.hotels[0], day.date));
    setPlanForm("");
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentTripData));
  }, [currentTripData]);

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
    const nextTripData = applyTripUpdates(currentTripData, updates);
    setCurrentTripData(nextTripData);
    const nextDay = buildTripDays(nextTripData).find((day) => day.date === activeDay?.date);
    if (nextDay) syncEditorState(nextDay, nextTripData);
  }

  function saveGeneral() {
    if (!activeDay) return;
    const updates: TripUpdateAction[] = [];
    if (titleForm.trim()) {
      updates.push({ type: "update_day_title", date: activeDay.date, title: titleForm.trim() });
    }
    if (summaryForm.trim()) {
      updates.push({ type: "update_day_summary", date: activeDay.date, summary: summaryForm.trim() });
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

  function saveFlight() {
    if (!activeDay || !flightForm.label.trim() || !flightForm.details.trim()) return;
    const existingFlight = activeDay.flights[0];
    applyDirectUpdates([existingFlight
      ? {
          type: "update_flight",
          date: existingFlight.date,
          label: existingFlight.label,
          nextLabel: flightForm.label.trim() !== existingFlight.label ? flightForm.label.trim() : undefined,
          details: flightForm.details.trim(),
          booking: flightForm.booking.trim() || undefined,
        }
      : {
          type: "add_flight",
          date: activeDay.date,
          label: flightForm.label.trim(),
          details: flightForm.details.trim(),
          booking: flightForm.booking.trim() || undefined,
        }]);
  }

  function removeFlight() {
    if (!activeDay?.flights[0]) return;
    applyDirectUpdates([{ type: "delete_flight", date: activeDay.flights[0].date, label: activeDay.flights[0].label }]);
  }

  function saveHotel() {
    if (!activeDay || !hotelForm.name.trim() || !hotelForm.location.trim() || !hotelForm.address.trim()) return;
    const existingHotel = activeDay.hotels[0];
    applyDirectUpdates([existingHotel
      ? {
          type: "update_hotel",
          name: existingHotel.name,
          nextName: hotelForm.name.trim() !== existingHotel.name ? hotelForm.name.trim() : undefined,
          address: hotelForm.address.trim(),
          phone: hotelForm.phone.trim() || undefined,
          confirmation: hotelForm.confirmation.trim() || undefined,
          location: hotelForm.location.trim(),
        }
      : {
          type: "add_hotel",
          name: hotelForm.name.trim(),
          location: hotelForm.location.trim(),
          checkIn: activeDay.date,
          checkOut: hotelForm.checkOut || shiftIsoDate(activeDay.date, 1),
          address: hotelForm.address.trim(),
          phone: hotelForm.phone.trim() || undefined,
          confirmation: hotelForm.confirmation.trim() || undefined,
        }]);
  }

  function removeHotel() {
    if (!activeDay?.hotels[0]) return;
    applyDirectUpdates([{ type: "delete_hotel", name: activeDay.hotels[0].name, checkIn: activeDay.hotels[0].checkIn }]);
  }

  function saveCar() {
    if (!activeDay || !Object.values(carForm).some((value) => value.trim())) return;
    applyDirectUpdates([{
      type: "update_car",
      date: activeDay.date,
      provider: carForm.provider.trim() || undefined,
      pickup: carForm.pickup.trim() || undefined,
      dropoff: carForm.dropoff.trim() || undefined,
      confirmation: carForm.confirmation.trim() || undefined,
      notes: carForm.notes.trim() || undefined,
    }]);
  }

  function removeCar() {
    if (!activeDay) return;
    applyDirectUpdates([{ type: "clear_car", date: activeDay.date }]);
  }

  function removeEvent(label: string) {
    if (!activeDay) return;
    applyDirectUpdates([{ type: "delete_event", date: activeDay.date, label }]);
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
            <div className="grid-day-title">{day.title}</div>
            <div className="grid-day-summary">{day.summary}</div>
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
                <p>{activeDay.summary}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeModal} aria-label="סגור פרטי יום">
                ✕
              </Button>
            </div>

            <div className="day-modal-meta">
              <span className="chip" style={locationTagStyles[activeDay.location.name]}>📍 {activeDay.location.name}</span>
              <span className="chip">{activeDay.location.region}</span>
              <span className="chip">{activeDay.travelMode}</span>
            </div>

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

              {activeEditTab === "flight" ? (
                <div className="day-modal-editor-grid">
                  <label className="day-modal-field">
                    <span>כותרת טיסה</span>
                    <input value={flightForm.label} onChange={(event) => setFlightForm((current) => ({ ...current, label: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>פרטי טיסה</span>
                    <textarea rows={3} value={flightForm.details} onChange={(event) => setFlightForm((current) => ({ ...current, details: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>אישור / Booking</span>
                    <input value={flightForm.booking} onChange={(event) => setFlightForm((current) => ({ ...current, booking: event.target.value }))} />
                  </label>
                  <div className="day-modal-actions">
                    <Button variant="primary" onClick={saveFlight}>שמור טיסה</Button>
                    <Button variant="ghost" onClick={removeFlight}>הסר טיסה</Button>
                  </div>
                </div>
              ) : null}

              {activeEditTab === "hotel" ? (
                <div className="day-modal-editor-grid two-cols">
                  <label className="day-modal-field">
                    <span>שם מלון</span>
                    <input value={hotelForm.name} onChange={(event) => setHotelForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>מיקום</span>
                    <input value={hotelForm.location} onChange={(event) => setHotelForm((current) => ({ ...current, location: event.target.value }))} />
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
                    <span>אישור</span>
                    <input value={hotelForm.confirmation} onChange={(event) => setHotelForm((current) => ({ ...current, confirmation: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>תאריך Checkout</span>
                    <input type="date" value={hotelForm.checkOut} onChange={(event) => setHotelForm((current) => ({ ...current, checkOut: event.target.value }))} />
                  </label>
                  <div className="day-modal-actions">
                    <Button variant="primary" onClick={saveHotel}>שמור מלון</Button>
                    <Button variant="ghost" onClick={removeHotel}>הסר מלון</Button>
                  </div>
                </div>
              ) : null}

              {activeEditTab === "car" ? (
                <div className="day-modal-editor-grid two-cols">
                  <label className="day-modal-field">
                    <span>ספק</span>
                    <input value={carForm.provider} onChange={(event) => setCarForm((current) => ({ ...current, provider: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>נקודת איסוף</span>
                    <input value={carForm.pickup} onChange={(event) => setCarForm((current) => ({ ...current, pickup: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>נקודת החזרה</span>
                    <input value={carForm.dropoff} onChange={(event) => setCarForm((current) => ({ ...current, dropoff: event.target.value }))} />
                  </label>
                  <label className="day-modal-field">
                    <span>אישור</span>
                    <input value={carForm.confirmation} onChange={(event) => setCarForm((current) => ({ ...current, confirmation: event.target.value }))} />
                  </label>
                  <label className="day-modal-field field-span-2">
                    <span>הערות</span>
                    <textarea rows={3} value={carForm.notes} onChange={(event) => setCarForm((current) => ({ ...current, notes: event.target.value }))} />
                  </label>
                  <div className="day-modal-actions">
                    <Button variant="primary" onClick={saveCar}>שמור רכב</Button>
                    <Button variant="ghost" onClick={removeCar}>הסר רכב</Button>
                  </div>
                </div>
              ) : null}
            </section>

            {activeDay.flights.length ? (
              <section className="day-modal-section">
                <h3>טיסות</h3>
                <div className="day-modal-list">
                  {activeDay.flights.map((flight) => (
                    <article key={`${flight.date}-${flight.label}`} className="day-modal-item">
                      <strong>✈️ {flight.label}</strong>
                      <p>{flight.details}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeDay.hotels.length ? (
              <section className="day-modal-section">
                <h3>מלון</h3>
                <div className="day-modal-list">
                  {activeDay.hotels.map((hotel) => (
                    <article key={`${hotel.name}-${hotel.checkIn}`} className="day-modal-item">
                      <strong>🏨 {hotel.name}</strong>
                      <p>{hotel.location} · {hotel.address}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeDay.car ? (
              <section className="day-modal-section">
                <h3>רכב</h3>
                <article className="day-modal-item">
                  <strong>🚗 {activeDay.car.provider || "רכב ליום"}</strong>
                  <p>{[activeDay.car.pickup, activeDay.car.dropoff, activeDay.car.notes].filter(Boolean).join(" · ") || "יש רכב משויך ליום הזה."}</p>
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
    </main>
  );
}
