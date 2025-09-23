import { useState, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';

export type TableData = { columns: string[]; rows: Record<string, any>[] };
export type ChartSuggestion = { type: "line" | "bar"; x: string; y: string[] };

export type ChatResp = {
  intent: "sql" | "semantic" | "mixed";
  answer?: string | null;
  sql?: string | null;
  table?: TableData | null;
  retrieval?: { column_id: string; score: number; original_name: string }[] | null;
  needs_disambiguation?: boolean | null;
  candidates?: string[] | null;
  chart_suggestion?: ChartSuggestion | null;
  detail?: string;
};

export function useDashboardChat() {
  const { getToken } = useAuth();
  const [datasetId, setDatasetId] = useState("");
  const [message, setMessage] = useState("");
  const [resp, setResp] = useState<ChatResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const canSend = useMemo(
    () => Boolean(datasetId && message && !loading),
    [datasetId, message, loading]
  );

  const callChat = async (extra?: { force_columns?: string[] }) => {
    setLoading(true);
    setError(undefined);
    try {
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dataset_id: datasetId, message, ...(extra ?? {}) }),
      });
      const data: ChatResp = await res.json();
      if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
      setResp(data);
    } catch (e: any) {
      setError(e.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setResp(null);
    callChat();
  };

  return {
    datasetId,
    setDatasetId,
    message,
    setMessage,
    resp,
    loading,
    error,
    canSend,
    callChat,
    handleSend,
  };
}
