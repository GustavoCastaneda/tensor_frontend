"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

export default function Dashboard() {
  const { getToken } = useAuth();
  const [datasetId, setDatasetId] = useState("");
  const [message, setMessage] = useState("");
  const [intent, setIntent] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    setIntent(undefined);

    try {
      const token = await getToken({ template: "Tensor" });
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dataset_id: datasetId, message }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
      setIntent(data.intent); // "sql" | "semantic" | "mixed"
    } catch (err: any) {
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-black">Probar router /chat</h1>

      <form onSubmit={handleSend} className="space-y-2">
        <input
          className="border px-2 py-1 text-black w-full"
          placeholder="Dataset ID (UUID)"
          value={datasetId}
          onChange={(e) => setDatasetId(e.target.value)}
        />
        <textarea
          className="border px-2 py-1 text-black w-full"
          placeholder='Escribe una pregunta, p.ej: "¿Cuál es la suma por mes?"'
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          className="border px-3 py-1 text-black"
          type="submit"
          disabled={!datasetId || !message || loading}
        >
          {loading ? "Enviando..." : "Enviar a /chat"}
        </button>
      </form>

      {intent && (
        <div className="text-black">
          <strong>Intent:</strong> {intent}
        </div>
      )}

      {error && (
        <div className="text-red-600">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
