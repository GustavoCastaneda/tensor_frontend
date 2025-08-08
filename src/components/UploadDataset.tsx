"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

interface PreviewRow {
  [key: string]: any;
}

type DatasetStatus =
  | "idle"
  | "pending"                // subiendo a Storage
  | "processing"             // leyendo & convirtiendo
  | "ready_for_embeddings"   // Parquet listo
  | "ready_for_chat"         // embeddings OK  // NEW
  | "error";

export default function UploadDataset() {
  const { getToken } = useAuth();
  const [file,   setFile]   = useState<File | null>(null);
  const [datasetId, setDatasetId] = useState<string>();
  const [status, setStatus] = useState<DatasetStatus>("idle");
  const [preview, setPreview] = useState<PreviewRow[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("pending");

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

    /* 3️⃣ Sube a Storage */
    const res2 = await fetch(upload_url, { method: "PUT", body: file });
    if (!res2.ok) throw new Error("Upload failed");
    setStatus("processing");

    /* 4️⃣ Polling de status */
    const intervalId = window.setInterval(async () => {
      const r = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${dataset_id}/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!r.ok) return;
      const { status: dsStatus } = await r.json();
      setStatus(dsStatus as DatasetStatus);

      /* 5️⃣ Cargar preview una sola vez */
      if (dsStatus === "ready_for_embeddings" && preview.length === 0) {
        const rPrev = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${dataset_id}/preview`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (rPrev.ok) {
          const { preview } = await rPrev.json();
          setPreview(preview);
        }
      }

      /* 6️⃣ Detener polling cuando llegue al final o error */
      if (dsStatus === "ready_for_chat" || dsStatus === "error") {
        window.clearInterval(intervalId);
      }
    }, 2500);
  }

  /* ───────── UI ───────── */
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-x-2">
        <input
          className="text-black"
          type="file"
          onChange={e => {
            setFile(e.target.files?.[0] ?? null);
            setPreview([]);
            setStatus("idle");
            setDatasetId(undefined);
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

      {preview.length > 0 && (
        <div className="text-black mt-6">
          <h3 className="font-semibold mb-2">
            Preview (primeras filas)
          </h3>
          <table className="border border-gray-400">
            <thead>
              <tr>
                {Object.keys(preview[0]).map(col => (
                  <th key={col} className="border px-2">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((val, j) => (
                    <td key={j} className="border px-2">{String(val)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {status === "ready_for_chat" && (
        <p className="text-green-600 font-bold">
          ✅ ¡Dataset listo para chatear!
        </p>
      )}
    </div>
  );
}
