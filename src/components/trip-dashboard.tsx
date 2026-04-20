"use client";

import { useState, useTransition } from "react";
import {
  buildAiAnswer,
  countLockedItems,
  countTransportDays,
  formatDate,
  getProgressRatio,
  tripData,
  type TripDay,
} from "@/lib/trip";

type Message = {
  role: "user" | "assistant";
  body: string;
};

type TripDashboardProps = {
  days: TripDay[];
};

const MAP_BOUNDS = { minLat: 25.6, maxLat: 41.3, minLng: -81.7, maxLng: -72.6 };

const quickPrompts = [
  { title: "מה חסר לי לסגור?", body: "נתח משימות פתוחות לפי היום שנבחר" },
  { title: "איך נראה מחר?", body: "תן תקציר לוגיסטי ליום הבא במסלול" },
  { title: "איפה יש עומס?", body: "אתר יום עמוס מדי והצע איזון" },
  { title: "תן המלצה ליום הזה", body: "מה כדאי לשפר ביום הנבחר?" },
];

export function TripDashboard({ days }: TripDashboardProps) {
  const [selectedDate, setSelectedDate] = useState(days[0]?.date ?? "");
  const [chatInput, setChatInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatHistory, setChatHistory] = useState<Message[]>([
    {
      role: "assistant",
      body: `אני רואה מסלול של ${days.length} ימים. בחר יום מהטיימליין, או שאל אותי מה חסר לסגור, איפה יש עומס, ואיך ללטש את התכנון.`,
    },
  ]);
  const [isPending, startTransition] = useTransition();

  const selectedDay = days.find((day) => day.date === selectedDate) ?? days[0];
  const nextDay = days[selectedDay.index + 1];
  const progress = Math.round(getProgressRatio(tripData) * 100);

  function submitPrompt(prompt: string) {
    if (!prompt.trim()) return;

    startTransition(async () => {
      const fallback = buildAiAnswer(prompt, selectedDay, days, tripData);

      setChatHistory((current) => [...current, { role: "user", body: prompt }]);
      setChatInput("");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, selectedDay }),
        });

        const payload = (await response.json()) as { error?: string; reply?: string; mode?: string };
        if (!response.ok) {
          throw new Error(payload.error || "chat request failed");
        }

        setChatHistory((current) => [...current, { role: "assistant", body: payload.reply || fallback }]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "chat request failed";
        setChatHistory((current) => [
          ...current,
          {
            role: "assistant",
            body: `${fallback}\n\nהערה טכנית: כרגע לא התקבלה תשובה חיה מ-OpenAI (${message}). צריך לוודא ש-OPENAI_API_KEY מוגדר ב-Vercel.`,
          },
        ]);
      }
    });
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
          <div className="timeline-list">
            {days.map((day) => {
              const preview = day.events[0] ? day.events[0].details.split("|")[0].trim() : day.summary;

              return (
                <button
                  key={day.date}
                  type="button"
                  className={`day-card ${day.date === selectedDate ? "active" : ""}`}
                  onClick={() => setSelectedDate(day.date)}
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
                      {day.hotels.length ? <span className="chip">לינה פעילה</span> : null}
                      <span className="chip">
                        {day.pendingTodos.length ? `${day.pendingTodos.length} משימות פתוחות` : "ללא פערים מיידיים"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="right-column">
          <section className="map-card">
            <div className="card-head">
              <div>
                <h3>מפת הסיפור של הטיול</h3>
                <p>המסך הימני מספר איפה כל יום קורה. בגרסה הבאה אפשר לחבר כאן Google Maps או Mapbox ולתמוך ב-routing והצעות AI גיאוגרפיות.</p>
              </div>
              <span className="badge">{selectedDay.location.region}</span>
            </div>
            <RouteMap days={days} selectedDate={selectedDate} />
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
                <div className="mini-stat-value">{countLockedItems(tripData)}</div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="detail-grid">
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
          <div className="section-title">אירועי היום</div>
          <div className="event-list">
            {selectedDay.flights.map((flight) => (
              <div key={`${selectedDay.date}-${flight.label}`} className="event-card">
                <div className="event-title"><span>✈️ {flight.label}</span><span>{selectedDay.travelMode}</span></div>
                <div className="event-body">{flight.details.replace(/\s*\|\s*/g, " · ")}</div>
              </div>
            ))}
            {selectedDay.events.map((event) => (
              <div key={`${selectedDay.date}-${event.label}`} className="event-card">
                <div className="event-title"><span>{event.emoji} {event.label}</span><span>{event.locked ? "נעול" : "גמיש"}</span></div>
                <div className="event-body">{event.details.replace(/\s*\|\s*/g, " · ")}</div>
              </div>
            ))}
            {!selectedDay.flights.length && !selectedDay.events.length ? (
              <div className="event-card">
                <div className="event-title"><span>יום פתוח</span><span>AI Opportunity</span></div>
                <div className="event-body">אין עדיין תוכן קשיח ליום הזה. זה בדיוק המקום שבו עוזר AI יכול להציע אטרקציות, מסלולים או קיצורי דרך.</div>
              </div>
            ) : null}
          </div>
        </section>

        <div>
          <aside className="logistics-card">
            <div className="card-head">
              <div>
                <h3>לוגיסטיקה חכמה</h3>
                <p>כאן אמורים להופיע בהמשך זמני נסיעה, check-in/out, חניות, מסמכים והתרעות.</p>
              </div>
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
              <span className="badge">{(selectedDay.pendingTodos.length || tripData.todos.filter((todo) => !todo.done).slice(0, 4).length)} פריטים</span>
            </div>
            <div className="task-list">
              {(selectedDay.pendingTodos.length ? selectedDay.pendingTodos : tripData.todos.filter((todo) => !todo.done).slice(0, 4)).map((task) => (
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
            <div className="card-head">
              <div>
                <h3>Trip AI Copilot</h3>
                <p>העוזר זמין מכל מקום במסך, בלי לתפוס את אזור העבודה הראשי.</p>
              </div>
              <div className="floating-chat-actions">
                <span className="badge">gpt-5.4-mini</span>
                <button
                  type="button"
                  className="floating-chat-close"
                  onClick={() => setIsChatOpen(false)}
                  aria-label="סגור חלון צ'אט"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="quick-prompts">
              {quickPrompts.map((prompt) => (
                <button key={prompt.title} type="button" className="prompt-btn" onClick={() => setChatInput(prompt.body)}>
                  <strong>{prompt.title}</strong>
                  <span>{prompt.body}</span>
                </button>
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
              <button className="chat-submit" type="submit">שלח</button>
            </form>
          </section>
        ) : null}

        <button
          type="button"
          className="assistant-launcher"
          onClick={() => setIsChatOpen((current) => !current)}
          aria-label={isChatOpen ? "מזער עוזר AI" : "פתח עוזר AI"}
        >
          <span className="assistant-launcher-icon">AI</span>
          <span className="assistant-launcher-copy">{isChatOpen ? "מזער עוזר" : "Trip AI"}</span>
        </button>
      </div>
    </div>
  );
}

function RouteMap({ days, selectedDate }: { days: TripDay[]; selectedDate: string }) {
  const polyline = days
    .map((day) => {
      const point = projectPoint(day.location);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  return (
    <div className="map-frame">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="מפת מסלול הטיול">
        <defs>
          <linearGradient id="routeGradient" x1="0" x2="1">
            <stop offset="0%" stopColor="#0c7c74" />
            <stop offset="100%" stopColor="#d56f3e" />
          </linearGradient>
        </defs>
        <path
          d="M76 8 C69 15, 66 23, 64 30 C62 38, 63 49, 58 55 C53 61, 47 70, 45 79 C43 85, 44 93, 49 96 L100 96 L100 0 L82 0 C80 2, 79 4, 76 8 Z"
          fill="rgba(255,255,255,0.55)"
          stroke="rgba(99,70,33,0.12)"
          strokeWidth="0.4"
        />
        <path
          d="M63 28 C66 35, 67 44, 63 52 C60 58, 55 65, 51 71 C47 77, 46 84, 49 92"
          fill="none"
          stroke="rgba(99,70,33,0.14)"
          strokeWidth="0.8"
          strokeDasharray="1.5 2.5"
        />
        <polyline points={polyline} fill="none" stroke="url(#routeGradient)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        {days.map((day) => {
          const point = projectPoint(day.location);
          const selected = day.date === selectedDate;
          return (
            <g key={day.date}>
              {selected ? <circle cx={point.x} cy={point.y} r="3.8" fill="rgba(12,124,116,0.14)" /> : null}
              <circle cx={point.x} cy={point.y} r={selected ? "2.2" : "1.25"} fill={selected ? "#0c7c74" : "#d56f3e"} />
              {selected ? (
                <text x={Math.min(point.x + 2.6, 90)} y={Math.max(point.y - 2.2, 6)} fontSize="3.2" fontFamily="Arial" fill="#2f2619">
                  {day.dayNum}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function projectPoint(location: TripDay["location"]) {
  const x = ((location.lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100;
  const y = 100 - ((location.lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100;
  return { x, y };
}
