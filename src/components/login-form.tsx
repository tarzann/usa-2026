"use client";

import { useState, useTransition } from "react";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error || "Login failed");
        return;
      }

      window.location.href = "/";
    });
  }

  return (
    <form className="login-form" onSubmit={onSubmit}>
      <label htmlFor="password">סיסמת גישה</label>
      <input
        id="password"
        type="password"
        className="login-input"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="הקלד סיסמה"
        autoComplete="current-password"
      />
      {error ? <div className="login-error">{error}</div> : null}
      <button className="chat-submit" type="submit" disabled={isPending}>
        {isPending ? "מתחבר..." : "כניסה"}
      </button>
    </form>
  );
}
