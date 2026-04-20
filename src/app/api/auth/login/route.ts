import { NextResponse } from "next/server";
import {
  createAuthToken,
  getAuthCookieMaxAge,
  getAuthCookieName,
  getAuthPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };
  const expectedPassword = getAuthPassword();

  if (!expectedPassword) {
    return NextResponse.json(
      { error: "APP_AUTH_PASSWORD is missing on the server" },
      { status: 503 },
    );
  }

  if (!body.password || body.password !== expectedPassword) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getAuthCookieName(),
    value: await createAuthToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: getAuthCookieMaxAge(),
  });

  return response;
}
