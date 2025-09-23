import React from 'react';

export type DocumentStatus =
  | "idle"
  | "pending"
  | "processing"
  | "ready_for_embeddings"
  | "ready_for_chat"
  | "error";

interface StatusBadgeProps {
  status: DocumentStatus;
  count: number;
  showCount?: boolean;
}

const STATUS_LABELS: Record<DocumentStatus, string> = {
  idle: "Esperando",
  pending: "Subiendo",
  processing: "Procesando",
  ready_for_embeddings: "Embeddings",
  ready_for_chat: "Listo",
  error: "Error",
};

const STATUS_BADGE_CLASSES: Record<DocumentStatus, string> = {
  idle: "bg-gray-100 text-gray-800",
  pending: "bg-blue-100 text-blue-800",
  processing: "bg-indigo-100 text-indigo-800",
  ready_for_embeddings: "bg-amber-100 text-amber-800",
  ready_for_chat: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

export function StatusBadge({ status, count, showCount = true }: StatusBadgeProps) {
  if (count === 0) return null;

  return (
    <span className={`text-xs px-2 py-1 rounded ${STATUS_BADGE_CLASSES[status]}`}>
      {STATUS_LABELS[status]}{showCount && `: ${count}`}
    </span>
  );
}

export { STATUS_LABELS, STATUS_BADGE_CLASSES };
