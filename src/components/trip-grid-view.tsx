"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { sanitizeTripData, buildTripDays, formatDate, type TripData } from "@/lib/trip";
import { type DayAttachment } from "@/lib/attachments";

type TripGridViewProps = {
  initialTripData: TripData;
};

const LOCAL_STORAGE_KEY = "trip-planner-data-v1";

function formatGridDayLabel(date: string, dayName: string) {
  const cleanDayName = dayName.replace(/^יום\s+/, "");
  return `${formatDate(date)} - ${cleanDayName}`;
}

function buildLocationTagStyles(locationNames: string[]) {
  const palettes = [
    { background: "#e7f7f4", color: "#0f766e" },
    { background: "#eef4ff", color: "#365fc7" },
    { background: "#fff2e8", color: "#b45309" },
    { background: "#f5efff", color: "#6d28d9" },
    { background: "#ecfdf3", color: "#15803d" },
    { background: "#fff1f2", color: "#be123c" },
    { background: "#eefbff", color: "#0369a1" },
    { background: "#fff7ed", color: "#c2410c" },
    { background: "#f3e8ff", color: "#7c3aed" },
    { background: "#ecfeff", color: "#0f766e" },
    { background: "#fef3c7", color: "#b45309" },
    { background: "#fce7f3", color: "#be185d" },
  ];

  const uniqueNames = [...new Set(locationNames.map((name) => name.trim()).filter(Boolean))];

  return Object.fromEntries(uniqueNames.map((name, index) => {
    const palette = palettes[index % palettes.length];

    return [
      name,
      {
        background: palette.background,
        color: palette.color,
        borderColor: `${palette.color}22`,
      },
    ];
  }));
}

export function TripGridView({ initialTripData }: TripGridViewProps) {
  const [currentTripData] = useState<TripData>(() => {
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
