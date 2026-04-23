import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get("pathname");

  if (!pathname) {
    return NextResponse.json({ error: "pathname is required" }, { status: 400 });
  }

  try {
    const result = await get(pathname, {
      access: "private",
    });

    if (!result) {
      return new NextResponse("Not found", { status: 404 });
    }

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          "Cache-Control": "private, no-cache",
        },
      });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(pathname.split("/").pop() || "file")}"`,
        "Cache-Control": "private, no-cache",
        ETag: result.blob.etag,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read file";
    const status = message.toLowerCase().includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
