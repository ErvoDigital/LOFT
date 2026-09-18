import { File, Film, Image, Music, FileText } from "lucide-react";

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function FileIcon({ mimeType, className }) {
  if (!mimeType) return <File className={className} />;
  if (mimeType.startsWith("video/")) return <Film className={className} />;
  if (mimeType.startsWith("image/")) return <Image className={className} />;
  if (mimeType.startsWith("audio/")) return <Music className={className} />;
  if (DOCUMENT_MIME_TYPES.has(mimeType)) return <FileText className={className} />;
  return <File className={className} />;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
