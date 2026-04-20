# USA 2026 Trip Planner AI

מערכת חכמה לניהול טיול עם חוויית תצוגה עשירה: ציר ימים, מפת מסלול, פרטי יום מלאים, ו-AI Copilot שמבין את המסלול ועוזר ללטש אותו.

הפרויקט כרגע בנוי כאפליקציית `Next.js`:

- `src/app` כולל את ה-App Router
- `src/components/trip-dashboard.tsx` כולל את ממשק המשתמש הראשי
- `src/lib/trip.ts` כולל את הלוגיקה והמודל של המסלול
- `src/app/api/chat/route.ts` מחבר את הצ'אט ל-OpenAI
- `src/data/trip-data.json` הוא מקור הנתונים של המסלול

## מה יש במערכת

- טיימליין יומי עם כותרת מרכזית לכל יום
- מפה ויזואלית של מסלול הטיול
- אזור פרטי יום מלא
- לוגיסטיקה, לינה ומשימות פתוחות
- צ'אט Prototype שמחזיר תשובות חכמות מתוך הנתונים

## איך מריצים

הרצה מקומית:

```bash
cd "/Users/ranmor/Documents/Trip Planner"
npm install
npm run dev
```

ואז לפתוח:

[http://localhost:3000](http://localhost:3000)

## משתני סביבה

צור קובץ `.env.local` מקומי או הגדר ב-Vercel:

```bash
OPENAI_API_KEY=your_api_key_here
APP_AUTH_PASSWORD=your_access_password
AUTH_SECRET=long_random_secret
```

- `OPENAI_API_KEY` חובה כדי שהצ'אט יעבוד מול OpenAI
- `APP_AUTH_PASSWORD` אופציונלי אבל מומלץ. אם הוא מוגדר, הכניסה הראשונית לאפליקציה תדרוש התחברות.
- `AUTH_SECRET` מומלץ כאשר מפעילים auth כדי לחתום את עוגיית ההתחברות.

אם אין `OPENAI_API_KEY`, המערכת תחזור זמנית ל-fallback מקומי ותציג הערה טכנית בצ'אט.

## מבנה נתונים

הקובץ `trip-data.json` כולל:

- `title`, `participants`, `startDate`, `endDate`
- `flights`
- `segments`
- `events`
- `hotels`
- `todos`

המערכת מייצרת מהם שכבת view-model של `tripDays`, שכל יום בה כולל:

- כותרת ראשית
- תקציר יום
- שיוך למקטע
- מיקום משוער למפה
- מצב לוגיסטי
- משימות פתוחות רלוונטיות

## כיוון מוצרי

הוויז'ן של המוצר:

1. המשתמש משוחח עם AI בשפה חופשית
2. ה-AI בונה ומעדכן את המסלול
3. ה-Timeline, המפה ופרטי היום מתעדכנים מיידית
4. המערכת מאתרת פערים, עומסים, התנגשויות והזדמנויות לשיפור

## השלב הבא

השלב ההגיוני הבא הוא לפצל את הפרויקט לארכיטקטורה מסודרת:

- `frontend` ב-React או Next.js
- `backend` קטן עם API
- חיבור ל-OpenAI API
- שמירת שיחות ועדכוני מסלול
- מודל נתונים עשיר יותר עם:
  - חלונות זמן
  - תקציב
  - תחבורה
  - סטטוס הזמנות
  - המלצות AI

## הצעת ארכיטקטורה

### Frontend

- Timeline panel
- Map panel
- Day details panel
- AI chat panel

### Backend

- `GET /trip`
- `POST /chat`
- `POST /trip/update`
- `POST /trip/analyze`

### AI flows

- בניית יום חדש מתוך בקשת משתמש
- אופטימיזציה של יום קיים
- זיהוי פערים לוגיסטיים
- יצירת הצעות למסלול חלופי

## הערות

- הצ'אט מחובר ל-OpenAI דרך `Responses API`
- המודל בקוד מוגדר במפורש ל-`gpt-5.4-mini`
- המפה היא ויזואליזציה מותאמת אישית ולא שירות מפות חיצוני
- הנתונים הקיימים עוברים סינון בסיסי כדי להתעלם מפריטים שמחוץ לטווח הטיול

## המשך פיתוח מומלץ

1. להעביר את הפרויקט ל-Next.js
2. להוסיף תמיכה ב-OpenAI API
3. לבנות עורך מסלול מתוך שיחה
4. לחבר מפה אמיתית עם Mapbox או Google Maps
5. להוסיף persistency למסלול ולשיחות
