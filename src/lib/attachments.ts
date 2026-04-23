export type DayAttachment = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
  contentType: string;
  downloadUrl?: string;
  name: string;
};

export function buildAttachmentPrefix(dayDate: string) {
  return `days/${dayDate}/`;
}

export function extractAttachmentName(pathname: string) {
  const filename = pathname.split("/").pop() || pathname;
  return filename.replace(/^[0-9]+-/, "");
}

export function inferAttachmentType(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
}
