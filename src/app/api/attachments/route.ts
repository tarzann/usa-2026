import { del, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  buildAttachmentPrefix,
  extractAttachmentName,
  inferAttachmentType,
} from "@/lib/attachments";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dayDate = searchParams.get("dayDate");

  if (!dayDate) {
    return NextResponse.json({ error: "dayDate is required" }, { status: 400 });
  }

  try {
    const { blobs } = await list({ prefix: buildAttachmentPrefix(dayDate) });
    const attachments = blobs
      .map((blob) => {
        const name = extractAttachmentName(blob.pathname);
        return {
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt.toISOString(),
        contentType: inferAttachmentType(name),
        downloadUrl: blob.downloadUrl,
        name,
      };
      })
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

    return NextResponse.json({ attachments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load attachments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const dayDate = String(formData.get("dayDate") || "");
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);

  if (!dayDate) {
    return NextResponse.json({ error: "dayDate is required" }, { status: 400 });
  }

  if (!files.length) {
    return NextResponse.json({ error: "At least one file is required" }, { status: 400 });
  }

  try {
    const uploads = await Promise.all(
      files.map(async (file) => {
        const pathname = `${buildAttachmentPrefix(dayDate)}${Date.now()}-${file.name}`;
        const blob = await put(pathname, file, {
          access: "public",
          addRandomSuffix: false,
          contentType: file.type || "application/octet-stream",
        });

        return {
          url: blob.url,
          pathname: blob.pathname,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          contentType: file.type || "application/octet-stream",
          downloadUrl: blob.downloadUrl,
          name: extractAttachmentName(blob.pathname),
        };
      }),
    );

    return NextResponse.json({ attachments: uploads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { url?: string };

  if (!body.url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    await del(body.url);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
