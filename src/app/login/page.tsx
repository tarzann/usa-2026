import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <span className="eyebrow">Secure Entry</span>
        <h1>התחברות למערכת הטיול</h1>
        <p className="lead">
          כדי לפתוח את Trip Planner AI צריך להתחבר פעם אחת עם סיסמת גישה.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
