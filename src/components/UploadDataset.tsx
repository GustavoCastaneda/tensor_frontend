"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";

interface PreviewRow {
  [key: string]: any;
}

type DatasetStatus =
  | "idle"
  | "pending"                // subiendo a Storage
  | "processing"             // leyendo & convirtiendo
  | "ready_for_embeddings"   // Parquet listo
  | "ready_for_chat"         // embeddings OK
  | "error";

export default function UploadDataset() {
  const { getToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [datasetId, setDatasetId] = useState<string>();
  const [status, setStatus] = useState<DatasetStatus>("idle");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string>("");

  // refs para manejar polling y evitar fugas
  const intervalRef = useRef<number | null>(null);
  const triesRef = useRef<number>(0);

  // limpiar interval al desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setError("");
    setStatus("pending");
    setPreview([]);

    // Si ya había un polling previo, lo limpio
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    triesRef.current = 0;

    try {
      /* 1️⃣ JWT */
      const token = await getToken({ template: "Tensor" });

      /* 2️⃣ Presigned URL */
      const res1 = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/upload-url?filename=${encodeURIComponent(file.name)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res1.ok) throw new Error(await res1.text());
      const { upload_url, dataset_id } = await res1.json();
      setDatasetId(dataset_id);

      /* 3️⃣ Sube a Storage (enviar Content-Type ayuda a algunos backends) */
      const res2 = await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!res2.ok) throw new Error("Upload failed");
      setStatus("processing");

      /* 4️⃣ Polling de status */
      intervalRef.current = window.setInterval(async () => {
        try {
          triesRef.current += 1;
          const r = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${dataset_id}/status`,
            { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
          );
          if (!r.ok) return;
          const { status: dsStatus } = await r.json();
          setStatus(dsStatus as DatasetStatus);

          /* 5️⃣ Cargar preview una sola vez (cuando esté listo para embeddings o chat) */
          if (
            (dsStatus === "ready_for_embeddings" || dsStatus === "ready_for_chat") &&
            preview.length === 0
          ) {
            const rPrev = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${dataset_id}/preview`,
              { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
            );
            if (rPrev.ok) {
              const { preview: pv } = await rPrev.json();
              setPreview(pv || []);
            }
          }

          /* 6️⃣ Detener polling en final o si excede intentos */
          if (dsStatus === "ready_for_chat" || dsStatus === "error" || triesRef.current > 120) {
            if (intervalRef.current) {
              window.clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            if (dsStatus === "error") setError("Ocurrió un error procesando el dataset.");
          }
        } catch (err: any) {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setError(err?.message ?? "Error consultando estado del dataset.");
        }
      }, 2500);
    } catch (err: any) {
      setStatus("error");
      setError(err?.message ?? "Error subiendo el archivo.");
    }
  }

  /* ───────── UI ───────── */
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-x-2">
        <input
          className="text-black"
          type="file"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview([]);
            setStatus("idle");
            setDatasetId(undefined);
            setError("");
          }}
        />
        <button
          className="text-black"
          type="submit"
          disabled={!file || status === "pending" || status === "processing"}
        >
          Upload
        </button>
      </form>

      <div className="text-black">
        <strong>Dataset ID:</strong> {datasetId || "-"}
      </div>
      <div className="text-black">
        <strong>Status:</strong> {status}
      </div>
      {error && (
        <div className="text-red-600">
          <strong>Error:</strong> {error}
        </div>
      )}

      {preview.length > 0 && (
        <div className="text-black mt-6">
          <h3 className="font-semibold mb-2">Preview (primeras filas)</h3>
          <div className="overflow-auto">
            <table className="border border-gray-400 min-w-full">
              <thead>
                <tr>
                  {Object.keys(preview[0]).map((col) => (
                    <th key={col} className="border px-2 text-left">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="border px-2">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {status === "ready_for_chat" && (
        <p className="text-green-600 font-bold">✅ ¡Dataset listo para chatear!</p>
      )}
    </div>
  );
}
