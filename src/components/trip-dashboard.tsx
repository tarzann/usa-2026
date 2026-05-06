"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition } from "react";
import { type DayAttachment } from "@/lib/attachments";
import { buildImmediateUpdateReply, inferTripUpdates } from "@/lib/trip-agent";
import type { FocusedMapLocation } from "@/components/real-trip-map";
import { Button } from "@/components/ui/button";
import {
  applyTripUpdates,
  buildAiAnswer,
  buildTripDays,
  countLockedItems,
  countTransportDays,
  formatDate,
  getProgressRatio,
  sanitizeTripData,
  type Flight,
  type TripData,
  type TripUpdateAction,
  type TripDay,
} from "@/lib/trip";

type Message = {
  role: "user" | "assistant";
  body: string;
};

type ChatScope = "global" | "day";

type TripDashboardProps = {
  days: TripDay[];
  initialTripData: TripData;
  googleMapsApiKey: string;
};

type DayPlanPeriod = "morning" | "afternoon" | "evening" | "logistics";
type DayPlanTone = "locked" | "planned" | "flexible" | "open";

type DayPlanItem = {
  id: string;
  title: string;
  details: string;
  icon: string;
  meta: string;
  period: DayPlanPeriod;
  status: string;
  tone: DayPlanTone;
  focusLabel: string;
  focusDetails: string;
};

type SmartBriefItem = {
  id: string;
  title: string;
  body: string;
  tone: "attention" | "positive" | "neutral";
  prompt: string;
};

type IntentAction = {
  id: string;
  label: string;
  prompt: string;
};

type FlightEditorState = {
  flightLabel: string;
  details: string;
};

const dayPlanPeriods: Array<{ id: DayPlanPeriod; title: string; helper: string }> = [
  { id: "morning", title: "בוקר", helper: "פתיחה נכונה ליום" },
  { id: "afternoon", title: "צהריים", helper: "עומק הפעילות" },
  { id: "evening", title: "ערב", helper: "סגירת היום" },
  { id: "logistics", title: "לוגיסטיקה", helper: "מעברים, לינה ומסמכים" },
];

const RealTripMap = dynamic(
  () => import("@/components/real-trip-map").then((module) => module.RealTripMap),
  {
    ssr: false,
    loading: () => <div className="map-frame map-loading">טוען מפה אינטראקטיבית...</div>,
  },
);

const quickPrompts = [
  { title: "מה חסר לי לסגור?", body: "נתח משימות פתוחות לפי היום שנבחר" },
  { title: "איך נראה מחר?", body: "תן תקציר לוגיסטי ליום הבא במסלול" },
  { title: "איפה יש עומס?", body: "אתר יום עמוס מדי והצע איזון" },
  { title: "תן המלצה ליום הזה", body: "מה כדאי לשפר ביום הנבחר?" },
];

const LOCAL_STORAGE_KEY = "trip-planner-data-v1";

export function TripDashboard({ days: initialDays, initialTripData, googleMapsApiKey }: TripDashboardProps) {
  const timelineListRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [selectedDate, setSelectedDate] = useState(initialDays[0]?.date ?? "");
  const [chatInput, setChatInput] = useState("");
  const [dayAgentInput, setDayAgentInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [attachments, setAttachments] = useState<DayAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const [attachmentsError, setAttachmentsError] = useState("");
  const [focusedLocation, setFocusedLocation] = useState<FocusedMapLocation | null>(null);
  const [flightEditor, setFlightEditor] = useState<FlightEditorState | null>(null);
  const [chatHistory, setChatHistory] = useState<Message[]>([
    {
      role: "assistant",
      body: `אני רואה מסלול של ${initialDays.length} ימים. בחר יום מהטיימליין, או שאל אותי מה חסר לסגור, איפה יש עומס, ואיך ללטש את התכנון.`,
    },
  ]);
  const [dayAgentHistory, setDayAgentHistory] = useState<Record<string, Message[]>>({});
  const [isPending, startTransition] = useTransition();
  const days = buildTripDays(currentTripData);
  const activeSelectedDate = days.some((day) => day.date === selectedDate) ? selectedDate : (days[0]?.date ?? "");
  const selectedDay = days.find((day) => day.date === activeSelectedDate) ?? days[0];
  const nextDay = days[selectedDay.index + 1];
  const progress = Math.round(getProgressRatio(currentTripData) * 100);
  const dayPlan = buildDayPlan(selectedDay);
  const dayStats = getDayStats(selectedDay);
  const smartBrief = buildSmartBrief(selectedDay, nextDay, attachments.length);
  const intentActions = buildIntentActions(selectedDay, currentTripData.flights.length > 0);
  const currentDayAgentHistory = dayAgentHistory[activeSelectedDate] ?? [buildDayAgentWelcomeMessage(selectedDay)];

  useEffect(() => {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentTripData));
  }, [currentTripData]);

  function selectDay(date: string) {
    setAttachmentsLoading(true);
    setAttachmentsError("");
    setFocusedLocation(null);
    setSelectedDate(date);
  }

  useEffect(() => {
    const container = timelineListRef.current;
    if (!container) return;

    const selectedCard = container.querySelector<HTMLButtonElement>(`[data-date="${activeSelectedDate}"]`);
    if (!selectedCard) return;

    container.scrollTo({
      top: selectedCard.offsetTop - container.offsetTop,
      behavior: "smooth",
    });
  }, [activeSelectedDate]);

  useEffect(() => {
    let active = true;

    fetch(`/api/attachments?dayDate=${encodeURIComponent(activeSelectedDate)}`)
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
        setAttachmentsError("לא הצלחנו לטעון את הקבצים של היום הזה.");
      })
      .finally(() => {
        if (!active) return;
        setAttachmentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeSelectedDate]);

  function appendMessage(scope: ChatScope, dayDate: string, message: Message) {
    if (scope === "day") {
      setDayAgentHistory((current) => ({
        ...current,
        [dayDate]: [...(current[dayDate] ?? [buildDayAgentWelcomeMessage(selectedDay)]), message],
      }));
      return;
    }

    setChatHistory((current) => [...current, message]);
  }

  function submitPrompt(prompt: string, scope: ChatScope = "global") {
    if (!prompt.trim()) return;

    startTransition(async () => {
      const scopedDay = selectedDay;
      const scopedTripData = currentTripData;
      const fallback = buildAiAnswer(prompt, scopedDay, days, scopedTripData);
      const sourceHistory = scope === "day" ? currentDayAgentHistory : chatHistory;
      const historyForRequest = [...sourceHistory.slice(-8), { role: "user" as const, body: prompt }];
      const immediateUpdates = inferTripUpdates(prompt, scopedDay, scopedTripData);

      appendMessage(scope, scopedDay.date, { role: "user", body: prompt });
      if (scope === "day") {
        setDayAgentInput("");
      } else {
        setChatInput("");
      }

      if (immediateUpdates.length) {
        setCurrentTripData((current) => applyTripUpdates(current, immediateUpdates));
        appendMessage(scope, scopedDay.date, { role: "assistant", body: buildImmediateUpdateReply(immediateUpdates) });
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 20000);
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, selectedDay: scopedDay, tripData: scopedTripData, history: historyForRequest, scope }),
          signal: controller.signal,
        });
        window.clearTimeout(timeoutId);

        const payload = (await response.json()) as { error?: string; reply?: string; mode?: string; updates?: TripUpdateAction[] };
        if (!response.ok) {
          throw new Error(payload.error || "chat request failed");
        }

        if (payload.updates?.length) {
          setCurrentTripData((current) => applyTripUpdates(current, payload.updates || []));
        }

        appendMessage(scope, scopedDay.date, { role: "assistant", body: payload.reply || fallback });
      } catch (error) {
        const message = error instanceof Error
          ? error.name === "AbortError"
            ? "הבקשה נמשכה יותר מדי זמן והופסקה"
            : error.message
          : "chat request failed";
        appendMessage(scope, scopedDay.date, {
          role: "assistant",
          body: `${fallback}\n\nהערה טכנית: כרגע לא התקבלה תשובה חיה מ-OpenAI (${message}). צריך לוודא ש-OPENAI_API_KEY מוגדר ב-Vercel.`,
        });
      }
    });
  }

  function applyDirectUpdates(updates: TripUpdateAction[]) {
    if (!updates.length) return;

    setCurrentTripData((current) => applyTripUpdates(current, updates));
    setChatHistory((current) => [...current, { role: "assistant", body: buildImmediateUpdateReply(updates) }]);
  }

  function openFlightEditor() {
    const flight = resolveFlightEditorTarget(selectedDay, currentTripData.flights);
    setFlightEditor({
      flightLabel: flight?.label || "",
      details: flight?.details || "",
    });
  }

  function submitFlightEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flightEditor?.flightLabel.trim() || !flightEditor.details.trim()) return;

    const flight = currentTripData.flights.find((item) => item.label === flightEditor.flightLabel);
    if (!flight) return;

    applyDirectUpdates([
      {
        type: "update_flight",
        date: flight.date,
        label: flight.label,
        details: flightEditor.details.trim(),
      },
    ]);
    setFlightEditor(null);
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      const formData = new FormData();
      formData.append("dayDate", activeSelectedDate);
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { attachments?: DayAttachment[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Upload failed");

      const listResponse = await fetch(`/api/attachments?dayDate=${encodeURIComponent(activeSelectedDate)}`);
      const listPayload = (await listResponse.json()) as { attachments?: DayAttachment[]; error?: string };
      if (!listResponse.ok) throw new Error(listPayload.error || "Failed to refresh attachments");

      setAttachments(listPayload.attachments || []);
      setAttachmentsError("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      const message = error instanceof Error ? error.message : "שמירת הקבצים נכשלה. נסה שוב.";
      setAttachmentsError(message);
    }
  }

  async function handleDeleteAttachment(url: string) {
    try {
      const response = await fetch("/api/attachments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Delete failed");

      const listResponse = await fetch(`/api/attachments?dayDate=${encodeURIComponent(activeSelectedDate)}`);
      const listPayload = (await listResponse.json()) as { attachments?: DayAttachment[]; error?: string };
      if (!listResponse.ok) throw new Error(listPayload.error || "Failed to refresh attachments");

      setAttachments(listPayload.attachments || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "מחיקת הקובץ נכשלה.";
      setAttachmentsError(message);
    }
  }

  function handleOpenAttachment(attachment: DayAttachment) {
    window.open(`/api/attachments/file?pathname=${encodeURIComponent(attachment.pathname)}`, "_blank", "noopener,noreferrer");
  }

  function formatAttachmentSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="shell">
      <section className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">Trip OS Vision • מערכת AI לתכנון טיול</span>
            <h1>הטיול שלך הופך ממסמך סטטי למערכת חיה, חכמה וויזואלית.</h1>
            <p className="lead">
              בנינו כאן גרסת מוצר ראשונה: המשתמש מדבר עם AI, בונה את הימים שלו, ורואה בזמן אמת ציר תאריכים ברור,
              מפה שמספרת איפה כל יום קורה, ופרטי יום עמוקים שמרכזים לוגיסטיקה, הזמנות, משימות והמלצות.
            </p>
            <div className="hero-stats">
              <div className="stat-card">
                <div className="stat-label">ימי טיול</div>
                <div className="stat-value">{days.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">ימים לוגיסטיים / מעבר</div>
                <div className="stat-value">{countTransportDays(days)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">רמת סגירה נוכחית</div>
                <div className="stat-value">{progress}%</div>
              </div>
            </div>
          </div>
          <aside className="vision-card">
            <h2>האיפיון שכבר מגולם במסך</h2>
            <p>זהו דשבורד מוצרי, לא רק עמוד טיול. הוא מכין אותנו לשלב הבא: חיבור ל-LLM, המלצות חיות, ואוטומציה של בניית מסלול.</p>
            <div className="vision-list">
              <div className="vision-item">
                <strong>Timeline כמקור אמת</strong>
                כל יום מקבל כרטיס עם כותרת חזקה, תקציר, מצב לוגיסטי ומיקום.
              </div>
              <div className="vision-item">
                <strong>Map as Storytelling</strong>
                המפה מציגה את נתיב הטיול, נקודת היום הנבחר, והקשר בין ימים עוקבים.
              </div>
              <div className="vision-item">
                <strong>AI Copilot</strong>
                הצ&apos;אט יודע לענות על שאלות תפעוליות, לאתר פערים ולהציע את הצעד הבא במסלול.
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="workspace">
        <section className="timeline-card">
          <div className="card-head">
            <div>
              <h3>ציר ימי הטיול</h3>
              <p>העמודה הזו היא עמוד השדרה של החוויה: כותרת חזקה לכל יום, סטטוס תכנוני מהיר, וסלקטור אחד שמניע את שאר המסך.</p>
            </div>
            <span className="badge">{days.length} ימים</span>
          </div>
          <div className="timeline-list" ref={timelineListRef}>
            {days.map((day) => {
              const preview = day.events[0] ? day.events[0].details.split("|")[0].trim() : day.summary;

              return (
                <button
                  key={day.date}
                  type="button"
                  data-date={day.date}
                  className={`day-card ${day.date === activeSelectedDate ? "active" : ""}`}
                  onClick={() => selectDay(day.date)}
                >
                  <div className="day-date">
                    <div className="num">{day.dayNum}</div>
                    <div className="month">{day.monthLabel}</div>
                    <div className="dow">{day.dayName.replace("יום ", "")}</div>
                  </div>
                  <div className="day-summary">
                    {day.segment ? (
                      <span className="segment-pill" style={{ background: day.segment.bg, color: day.segment.text }}>
                        {day.segment.label}
                      </span>
                    ) : null}
                    <div className="day-title">{day.title}</div>
                    <div className="day-meta">{day.location.name} · {day.travelMode}</div>
                    <div className="day-preview">{preview}</div>
                    <div className="day-flags">
                      {day.flights.length ? <span className="chip">טיסה</span> : null}
                      {day.pendingTodos.length ? <span className="chip">{day.pendingTodos.length} משימות</span> : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="detail-card">
          <div className="detail-header">
            <div>
              <div className="section-title">{selectedDay.dayName} · {formatDate(selectedDay.date)}</div>
              <h2>{selectedDay.title}</h2>
              <p>{selectedDay.summary}</p>
            </div>
            <div className="detail-actions">
              <span className="chip">{selectedDay.segment ? selectedDay.segment.label : "יום פתוח"}</span>
              <span className="chip">{selectedDay.location.name}</span>
              <span className="chip">{selectedDay.travelMode}</span>
            </div>
          </div>

          <div className="day-intelligence-strip" aria-label="תקציר מצב היום">
            <div>
              <span>{dayStats.locked}</span>
              <strong>נעולים</strong>
            </div>
            <div>
              <span>{dayStats.flexible}</span>
              <strong>גמישים</strong>
            </div>
            <div>
              <span>{selectedDay.pendingTodos.length}</span>
              <strong>משימות</strong>
            </div>
            <div>
              <span>{attachments.length}</span>
              <strong>קבצים</strong>
            </div>
          </div>

          <div className="section-title">תכנון היום</div>
          <div className="daily-plan-board">
            {dayPlanPeriods.map((period) => {
              const items = dayPlan.filter((item) => item.period === period.id);
              if (!items.length) return null;

              return (
                <section key={period.id} className="plan-period">
                  <div className="plan-period-head">
                    <div>
                      <h4>{period.title}</h4>
                      <p>{period.helper}</p>
                    </div>
                    <span>{items.length}</span>
                  </div>
                  <div className="plan-period-list">
                    {items.length ? items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`plan-item plan-item-button plan-item-${item.tone}`}
                        onClick={() => setFocusedLocation(resolveEventLocation(item.focusLabel, item.focusDetails, selectedDay))}
                      >
                        <div className="plan-item-top">
                          <span className="plan-item-icon">{item.icon}</span>
                          <span className="plan-item-title">{item.title}</span>
                          <span className="plan-status">{item.status}</span>
                        </div>
                        <div className="plan-item-body">{item.details}</div>
                        <div className="plan-item-meta">{item.meta}</div>
                      </button>
                    )) : (
                      <div className="plan-empty">אין עדיין פריט מוגדר. מקום טוב להמלצת AI.</div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="section-title" style={{ marginTop: "18px" }}>סוכן היום</div>
          <section className="day-agent-card">
            <div className="day-agent-head">
              <div>
                <strong>Trip AI ליום הזה בלבד</strong>
                <p>שינויים כאן מתייחסים ל-{formatDate(selectedDay.date)} ולפריטים של היום הנבחר.</p>
              </div>
              <span className="chip">יום ממוקד</span>
            </div>
            <div className="day-agent-messages">
              {currentDayAgentHistory.map((message, index) => (
                <div key={`${selectedDay.date}-${message.role}-${index}`} className={`message ${message.role}`}>
                  <span className="message-role">{message.role === "user" ? "אתה" : "סוכן היום"}</span>
                  <div className="message-body">{message.body}</div>
                </div>
              ))}
              {isPending ? (
                <div className="message assistant">
                  <span className="message-role">סוכן היום</span>
                  <div className="message-body">מעדכן את היום הזה...</div>
                </div>
              ) : null}
            </div>
            <form
              className="day-agent-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitPrompt(dayAgentInput, "day");
              }}
            >
              <textarea
                className="day-agent-input"
                value={dayAgentInput}
                onChange={(event) => setDayAgentInput(event.target.value)}
                placeholder='לדוגמה: שנה את כותרת היום ל"יום רגוע במיאמי"'
              />
              <Button className="day-agent-submit" variant="primary" type="submit">עדכן יום</Button>
            </form>
          </section>

          <div className="section-title" style={{ marginTop: "18px" }}>מסמכים וקבצים</div>
          <div className="attachments-actions">
            <input
              ref={fileInputRef}
              type="file"
              className="attachments-input"
              multiple
              onChange={handleFileSelect}
            />
          </div>
          {attachmentsError ? <div className="attachments-error">{attachmentsError}</div> : null}
          <div className="attachments-list">
            {attachmentsLoading ? <div className="attachments-empty">טוען קבצים...</div> : null}
            {!attachmentsLoading && !attachments.length ? (
              <div className="attachments-empty">עדיין אין קבצים ליום הזה.</div>
            ) : null}
            {!attachmentsLoading && attachments.map((attachment) => (
              <div key={attachment.url} className="attachment-item">
                <button type="button" className="attachment-main" onClick={() => handleOpenAttachment(attachment)}>
                  <strong>{attachment.name}</strong>
                  <span>{attachment.contentType || "קובץ"}</span>
                  <span>{formatAttachmentSize(attachment.size)}</span>
                </button>
                <button
                  type="button"
                  className="attachment-delete"
                  onClick={() => handleDeleteAttachment(attachment.url)}
                  aria-label={`מחק ${attachment.name}`}
                >
                  מחק
                </button>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="map-card map-card-wide">
        <div className="card-head">
          <div>
            <h3>מפת הסיפור של הטיול</h3>
            <p>המפה עכשיו חיה ואינטראקטיבית, עם markers אמיתיים ונתיב שמחבר בין ימי המסלול.</p>
          </div>
          <span className="badge">{selectedDay.location.region}</span>
        </div>
        <RealTripMap
          apiKey={googleMapsApiKey}
          days={days}
          selectedDate={activeSelectedDate}
          focusedLocation={focusedLocation}
        />
        <div className="map-note">
          <div className="mini-stat">
            <div className="mini-stat-label">היום הנבחר</div>
            <div className="mini-stat-value">{selectedDay.location.name}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">מחר במסלול</div>
            <div className="mini-stat-value">{nextDay ? nextDay.location.name : "סיום הטיול"}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">פריטים נעולים</div>
            <div className="mini-stat-value">{countLockedItems(currentTripData)}</div>
          </div>
        </div>
      </section>

      <section className="detail-grid">

        <div>
          <aside className="logistics-card">
            <div className="card-head">
              <div>
                <h3>Brief חכם ליום</h3>
                <p>המערכת מזהה לבד נקודות שדורשות תשומת לב, ואז מאפשרת לפתוח שיחה ממוקדת עם ה-AI.</p>
              </div>
            </div>
            <div className="smart-brief-list">
              {smartBrief.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={`smart-brief-item smart-brief-${item.tone}`}
                  onClick={() => {
                    setIsChatOpen(true);
                    submitPrompt(item.prompt);
                  }}
                >
                  <span className="smart-brief-kicker">{item.title}</span>
                  <span className="smart-brief-body">{item.body}</span>
                  <span className="smart-brief-action">שאל את Trip AI</span>
                </Button>
              ))}
            </div>
            <div className="logistics-list">
              <div className="logistics-item">
                <div className="logistics-title"><span>צעד הבא במסלול</span><span>{selectedDay.travelMode}</span></div>
                <div className="logistics-body">
                  {selectedDay.location.name} → {nextDay ? nextDay.location.name : "סיום מסלול"}
                </div>
              </div>
              {selectedDay.hotels.length ? selectedDay.hotels.map((hotel) => (
                <div key={`${hotel.name}-${hotel.checkIn}`} className="logistics-item">
                  <div className="logistics-title"><span>לינה</span><span>{hotel.location}</span></div>
                  <div className="logistics-body">{hotel.name}<br />{hotel.address}<br />אישור: {hotel.confirmation}</div>
                </div>
              )) : (
                <div className="logistics-item">
                  <div className="logistics-title"><span>לינה</span><span>פתוח</span></div>
                  <div className="logistics-body">לא נמצאה לינה משויכת ליום הזה. זו נקודת מעקב טובה לסגירה.</div>
                </div>
              )}
            </div>
          </aside>

          <div className="gap-block" />

          <aside className="tasks-card">
            <div className="card-head">
              <div>
                <h3>מה פתוח לסגירה</h3>
                <p>המערכת מאתרת משימות רלוונטיות ליום הנבחר, ובאין התאמה מציגה את המשימות הדחופות הכלליות.</p>
              </div>
              <span className="badge">{(selectedDay.pendingTodos.length || currentTripData.todos.filter((todo) => !todo.done).slice(0, 4).length)} פריטים</span>
            </div>
            <div className="task-list">
              {(selectedDay.pendingTodos.length ? selectedDay.pendingTodos : currentTripData.todos.filter((todo) => !todo.done).slice(0, 4)).map((task) => (
                <div key={task.text} className={`task-item ${task.done ? "done" : ""}`}>
                  <span className="task-status" />
                  <div className="task-copy">{task.text}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <div className="footer-note">הגרסה הזו מוכנה כבסיס למוצר AI אמיתי: השלב הבא הוא חיבור ל-OpenAI, שמירת שיחות ועדכון המסלול מתוך הדיאלוג.</div>

      <div className="assistant-widget">
        {isChatOpen ? (
          <section className="chat-card floating-chat">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="floating-chat-head">
              <div>
                <div className="assistant-status">
                  <span />
                  <strong>Trip AI פעיל</strong>
                </div>
                <h3>איך אפשר לעזור ביום הזה?</h3>
                <p>{selectedDay.title} · {formatDate(selectedDay.date)}</p>
              </div>
              <div className="floating-chat-actions">
                <Button
                  variant="ghost"
                  size="icon"
                  className="floating-chat-close"
                  onClick={() => setIsChatOpen(false)}
                  aria-label="סגור חלון צ'אט"
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="intent-bar">
              {intentActions.map((action) => (
                <Button
                  key={action.id}
                  variant="glass"
                  size="sm"
                  className="intent-chip"
                  onClick={() => {
                    if (action.id === "flight-editor") {
                      openFlightEditor();
                      return;
                    }
                    setChatInput(action.prompt);
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
            {flightEditor ? (
              <form className="inline-tool-card" onSubmit={submitFlightEditor}>
                <div className="inline-tool-head">
                  <strong>עדכון טיסה</strong>
                  <Button variant="ghost" size="sm" onClick={() => setFlightEditor(null)} type="button">
                    סגור
                  </Button>
                </div>
                <label className="inline-tool-field">
                  <span>איזו טיסה?</span>
                  <select
                    className="inline-tool-select"
                    value={flightEditor.flightLabel}
                    onChange={(event) => {
                      const selectedFlight = currentTripData.flights.find((flight) => flight.label === event.target.value);
                      setFlightEditor({
                        flightLabel: event.target.value,
                        details: selectedFlight?.details || "",
                      });
                    }}
                  >
                    {currentTripData.flights.map((flight) => (
                      <option key={`${flight.date}-${flight.label}`} value={flight.label}>
                        {flight.label} · {formatDate(flight.date)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-tool-field">
                  <span>פרטי טיסה</span>
                  <textarea
                    className="inline-tool-textarea"
                    value={flightEditor.details}
                    onChange={(event) => setFlightEditor((current) => current ? { ...current, details: event.target.value } : current)}
                    placeholder="TLV → ZRH → JFK | המראה 05:30 | נחיתה 13:10"
                  />
                </label>
                <Button variant="primary" type="submit">עדכן טיסה</Button>
              </form>
            ) : null}
            <div className="quick-prompts">
              {quickPrompts.map((prompt) => (
                <Button key={prompt.title} variant="glass" size="sm" className="prompt-btn" onClick={() => setChatInput(prompt.body)}>
                  <strong>{prompt.title}</strong>
                  <span>{prompt.body}</span>
                </Button>
              ))}
            </div>
            <div className="chat-messages">
              {chatHistory.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`message ${message.role}`}>
                  <span className="message-role">{message.role === "user" ? "אתה" : "Trip AI"}</span>
                  <div className="message-body">{message.body}</div>
                </div>
              ))}
              {isPending ? (
                <div className="message assistant">
                  <span className="message-role">Trip AI</span>
                  <div className="message-body">חושב על המסלול...</div>
                </div>
              ) : null}
            </div>
            <form
              className="chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitPrompt(chatInput);
              }}
            >
              <textarea
                className="chat-input"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="לדוגמה: מה חסר לי לסגור ליום הזה?"
              />
              <Button className="chat-submit" variant="primary" type="submit">שלח</Button>
            </form>
          </section>
        ) : null}

        <Button
          variant="primary"
          size="lg"
          className="assistant-launcher"
          onClick={() => setIsChatOpen((current) => !current)}
          aria-label={isChatOpen ? "מזער עוזר AI" : "פתח עוזר AI"}
        >
          <span className="assistant-launcher-icon">AI</span>
          <span className="assistant-launcher-copy">{isChatOpen ? "מזער עוזר" : "Trip AI"}</span>
        </Button>
      </div>
    </div>
  );
}

function buildDayPlan(day: TripDay): DayPlanItem[] {
  const flightItems: DayPlanItem[] = day.flights.map((flight) => ({
    id: `${day.date}-flight-${flight.label}`,
    title: flight.label,
    details: formatPlanDetails(flight.details),
    icon: "טיסה",
    meta: day.travelMode,
    period: "logistics",
    status: "נעול",
    tone: "locked",
    focusLabel: flight.label,
    focusDetails: flight.details,
  }));

  const eventItems: DayPlanItem[] = day.events.map((event) => ({
    id: `${day.date}-event-${event.label}`,
    title: event.label,
    details: formatPlanDetails(event.details),
    icon: event.emoji,
    meta: event.locked ? "פריט סגור במסלול" : "אפשר עדיין להזיז או לדייק",
    period: detectPlanPeriod(event.label, event.details),
    status: event.locked ? "נעול" : "גמיש",
    tone: event.locked ? "planned" : "flexible",
    focusLabel: event.label,
    focusDetails: event.details,
  }));

  const hotelItems: DayPlanItem[] = day.hotels.map((hotel) => ({
    id: `${day.date}-hotel-${hotel.name}`,
    title: hotel.name,
    details: `${hotel.location} · ${hotel.address}`,
    icon: "לינה",
    meta: hotel.confirmation ? `אישור ${hotel.confirmation}` : "לינה משויכת ליום",
    period: "logistics",
    status: "סגור",
    tone: "locked",
    focusLabel: hotel.location,
    focusDetails: `${hotel.name} ${hotel.address}`,
  }));

  const items = [...flightItems, ...eventItems, ...hotelItems];
  if (items.length) return items;

  return [{
    id: `${day.date}-open-day`,
    title: "יום פתוח לתכנון",
    details: "אין עדיין תוכן קשיח ליום הזה. אפשר לבקש מה-AI לבנות הצעה לפי אזור, קצב ורמת עומס.",
    icon: "AI",
    meta: day.location.name,
    period: "morning",
    status: "פתוח",
    tone: "open",
    focusLabel: day.location.name,
    focusDetails: day.summary,
  }];
}

function detectPlanPeriod(label: string, details: string): DayPlanPeriod {
  const text = `${label} ${details}`.toLowerCase();
  if (text.includes("בוקר") || text.includes("morning") || text.includes("check-out")) return "morning";
  if (text.includes("צהר") || text.includes("noon") || text.includes("afternoon") || text.includes("park")) return "afternoon";
  if (text.includes("ערב") || text.includes("evening") || text.includes("dinner") || text.includes("לילה")) return "evening";
  if (text.includes("טיסה") || text.includes("רכבת") || text.includes("נסיעה") || text.includes("מעבורת")) return "logistics";
  return "afternoon";
}

function formatPlanDetails(details: string) {
  return details.replace(/\s*\|\s*/g, " · ");
}

function getDayStats(day: TripDay) {
  return {
    locked: day.flights.length + day.hotels.length + day.events.filter((event) => event.locked).length,
    flexible: day.events.filter((event) => !event.locked).length,
  };
}

function buildIntentActions(day: TripDay, hasFlights: boolean): IntentAction[] {
  const firstHotel = day.hotels[0];
  const firstEvent = day.events[0];

  return [
    {
      id: "day-title",
      label: "עדכון יום",
      prompt: `שנה את כותרת היום ל"${day.title}"`,
    },
    {
      id: "add-event",
      label: "הוספת אירוע",
      prompt: `הוסף אירוע: `,
    },
    {
      id: "flight-editor",
      label: "עדכון טיסה",
      prompt: hasFlights ? "" : `עדכן את הטיסה של היום האחרון: `,
    },
    {
      id: "hotel",
      label: "עדכון מלון",
      prompt: firstHotel
        ? `עדכן את המלון "${firstHotel.name}": ${firstHotel.address}`
        : `עדכן את המלון של היום: `,
    },
    {
      id: "move-event",
      label: "העבר אירוע",
      prompt: firstEvent
        ? `העבר את האירוע "${firstEvent.label}" למחר`
        : `העבר את האירוע למחר: `,
    },
    {
      id: "remove-day",
      label: "הסר יום",
      prompt: `מחק את היום הזה`,
    },
  ];
}

function buildDayAgentWelcomeMessage(day: TripDay): Message {
  return {
    role: "assistant",
    body: `אני ממוקד רק ב-${formatDate(day.date)}. אפשר לבקש ממני לעדכן כותרת, סיכום, אירועים, טיסה או מלון של היום הזה בלבד.`,
  };
}

function resolveFlightEditorTarget(day: TripDay, flights: Flight[]) {
  if (day.flights.length) return day.flights[0];
  return flights[flights.length - 1] ?? flights[0] ?? null;
}

function buildSmartBrief(day: TripDay, nextDay: TripDay | undefined, attachmentsCount: number): SmartBriefItem[] {
  const brief: SmartBriefItem[] = [];
  const anchorCount = day.flights.length + day.events.length + day.hotels.length;

  if (day.flights.length || day.travelMode !== "יום יעד") {
    brief.push({
      id: "transition",
      title: "יום מעבר",
      body: nextDay
        ? `היום מחבר בין ${day.location.name} ל-${nextDay.location.name}. כדאי לוודא זמני יציאה, נסיעה ומרווחי ביטחון.`
        : "זה יום הסיום של המסלול. כדאי לוודא טיסה, החזרת רכב וזמני הגעה לשדה.",
      tone: "attention",
      prompt: `תכין לי brief לוגיסטי ל-${formatDate(day.date)} כולל זמני מעבר, מרווחי ביטחון ומה אסור לפספס.`,
    });
  }

  if (!day.hotels.length && !day.flights.length) {
    brief.push({
      id: "lodging",
      title: "לינה לבדיקה",
      body: "לא משויכת לינה ליום הזה. יכול להיות שזה תקין, אבל זו נקודה שכדאי לאמת לפני הטיול.",
      tone: "attention",
      prompt: `בדוק את יום ${formatDate(day.date)} והצע מה צריך לוודא לגבי לינה ומיקום בסיס.`,
    });
  }

  if (!attachmentsCount && (day.flights.length || day.hotels.length || day.events.some((event) => event.locked))) {
    brief.push({
      id: "documents",
      title: "מסמכים חסרים",
      body: "יש פריטים סגורים ביום הזה, אבל עדיין לא הועלו קבצים. מומלץ לצרף כרטיסים, אישורים או הזמנות.",
      tone: "neutral",
      prompt: `איזה מסמכים כדאי לשמור עבור ${formatDate(day.date)} לפי הטיסות, הלינה והאירועים של היום?`,
    });
  }

  if (anchorCount >= 3) {
    brief.push({
      id: "load",
      title: "יום עמוס",
      body: `זוהו ${anchorCount} עוגנים ביום אחד. שווה לבדוק אם יש מספיק מרווח נשימה בין הפריטים.`,
      tone: "attention",
      prompt: `בדוק אם ${formatDate(day.date)} עמוס מדי והצע סידור מאוזן יותר לפי בוקר, צהריים וערב.`,
    });
  }

  if (!brief.length) {
    brief.push({
      id: "open-opportunity",
      title: "יום גמיש",
      body: "אין הרבה אילוצים קשיחים. זה מקום טוב לתת ל-AI להציע מסלול קליל לפי האזור והקצב שלכם.",
      tone: "positive",
      prompt: `בנה לי הצעה נעימה וגמישה ל-${formatDate(day.date)} באזור ${day.location.name}, בלי להעמיס.`,
    });
  }

  return brief.slice(0, 3);
}

function resolveEventLocation(label: string, details: string, fallbackDay: TripDay): FocusedMapLocation {
  const text = `${label} ${details}`.toLowerCase();
  const candidates: Array<FocusedMapLocation & { keywords: string[] }> = [
    {
      title: "NY → DC ברכבת",
      subtitle: "Penn Station → Union Station",
      lat: 39.8502,
      lng: -75.4802,
      keywords: ["ny → dc", "penn station", "union station", "amtrak"],
      route: {
        origin: { lat: 40.7506, lng: -73.9935, label: "Penn Station, New York" },
        destination: { lat: 38.8977, lng: -77.0065, label: "Union Station, Washington DC" },
        mode: "TRANSIT",
      },
    },
    {
      title: "טיסה תל אביב → ניו יורק",
      subtitle: "TLV → ZRH → JFK",
      lat: 46.5,
      lng: -29.0,
      keywords: ["tlv", "zrh", "jfk", "הלוך"],
      route: {
        origin: { lat: 32.0055, lng: 34.8854, label: "Ben Gurion Airport" },
        stops: [{ lat: 47.4581, lng: 8.5555, label: "Zurich Airport" }],
        destination: { lat: 40.6413, lng: -73.7781, label: "JFK Airport" },
        mode: "FLYING",
      },
    },
    {
      title: "טיסה מיאמי → תל אביב",
      subtitle: "MIA → FRA → TLV",
      lat: 43.0,
      lng: -25.0,
      keywords: ["mia", "fra", "חזרה"],
      route: {
        origin: { lat: 25.7959, lng: -80.287, label: "Miami International Airport" },
        stops: [{ lat: 50.0379, lng: 8.5622, label: "Frankfurt Airport" }],
        destination: { lat: 32.0055, lng: 34.8854, label: "Ben Gurion Airport" },
        mode: "FLYING",
      },
    },
    { title: "JFK Airport", subtitle: "New York", lat: 40.6413, lng: -73.7781, keywords: ["jfk"] },
    { title: "Times Square", subtitle: "New York", lat: 40.758, lng: -73.9855, keywords: ["times square"] },
    { title: "Brooklyn Bridge", subtitle: "New York", lat: 40.7061, lng: -73.9969, keywords: ["brooklyn bridge", "גשר ברוקלין"] },
    { title: "Statue of Liberty", subtitle: "New York Harbor", lat: 40.6892, lng: -74.0445, keywords: ["statue of liberty", "liberty"] },
    { title: "9/11 Memorial", subtitle: "Lower Manhattan", lat: 40.7115, lng: -74.0134, keywords: ["9/11"] },
    { title: "American Museum of Natural History", subtitle: "New York", lat: 40.7813, lng: -73.9735, keywords: ["amnh", "natural history"] },
    { title: "Central Park", subtitle: "New York", lat: 40.7829, lng: -73.9654, keywords: ["central park"] },
    { title: "Lincoln Memorial", subtitle: "Washington DC", lat: 38.8893, lng: -77.0502, keywords: ["lincoln"] },
    { title: "National Air and Space Museum", subtitle: "Washington DC", lat: 38.8882, lng: -77.0199, keywords: ["air & space", "air and space"] },
    { title: "Georgetown", subtitle: "Washington DC", lat: 38.9097, lng: -77.0654, keywords: ["georgetown"] },
    { title: "Norfolk", subtitle: "Virginia", lat: 36.8508, lng: -76.2859, keywords: ["norfolk"] },
    { title: "Outer Banks", subtitle: "North Carolina", lat: 35.5582, lng: -75.4665, keywords: ["outer banks", "ocracoke"] },
    { title: "Charleston", subtitle: "South Carolina", lat: 32.7765, lng: -79.9311, keywords: ["charleston"] },
    { title: "Savannah", subtitle: "Georgia", lat: 32.0809, lng: -81.0912, keywords: ["savannah"] },
    { title: "Magic Kingdom", subtitle: "Walt Disney World", lat: 28.4194, lng: -81.5812, keywords: ["magic kingdom"] },
    { title: "EPCOT", subtitle: "Walt Disney World", lat: 28.3747, lng: -81.5494, keywords: ["epcot"] },
    { title: "Animal Kingdom", subtitle: "Walt Disney World", lat: 28.3554, lng: -81.5903, keywords: ["animal kingdom"] },
    { title: "Epic Universe", subtitle: "Universal Orlando", lat: 28.4401, lng: -81.4475, keywords: ["epic universe"] },
    { title: "Islands of Adventure", subtitle: "Universal Orlando", lat: 28.4727, lng: -81.4713, keywords: ["islands of adventure"] },
    { title: "Kennedy Space Center", subtitle: "Florida", lat: 28.5729, lng: -80.649, keywords: ["kennedy"] },
    { title: "Miami", subtitle: "Florida", lat: 25.7617, lng: -80.1918, keywords: ["miami"] },
  ];

  const match = candidates.find((candidate) => candidate.keywords.some((keyword) => text.includes(keyword)));
  if (match) {
    return {
      title: match.title,
      subtitle: match.subtitle,
      lat: match.lat,
      lng: match.lng,
      route: match.route,
    };
  }

  return {
    title: label,
    subtitle: fallbackDay.location.name,
    lat: fallbackDay.location.lat,
    lng: fallbackDay.location.lng,
  };
}
