"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

interface PreviewRow {
  [key: string]: any;
}

export default function UploadDataset() {
  const { getToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [datasetId, setDatasetId] = useState<string>();
  const [status, setStatus] = useState<"idle"|"pending"|"processing"|"ready"|"error">("idle");
  const [preview, setPreview] = useState<PreviewRow[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("pending");

    // 1) JWT
    const token = await getToken({ template: "Tensor" });

    // 2) Solicita presigned URL
    const res1 = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/upload-url?filename=${encodeURIComponent(file.name)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!res1.ok) {
      const txt = await res1.text();
      throw new Error(`Failed to get upload URL: ${txt}`);
    }
    const { upload_url, dataset_id } = await res1.json();
    setDatasetId(dataset_id);

    // 3) Sube el archivo a Supabase
    const res2 = await fetch(upload_url, {
      method: "PUT",
      body: file,
    });
    if (!res2.ok) throw new Error("Upload failed");

    setStatus("processing");

    // 4) Polling de status
    const intervalId = window.setInterval(async () => {
      const res3 = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${dataset_id}/status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res3.ok) return;
      const { status: dsStatus } = await res3.json();
      setStatus(dsStatus);

      if (dsStatus === "ready" || dsStatus === "error") {
        window.clearInterval(intervalId);

        if (dsStatus === "ready") {
          // 5) Cuando esté listo, pide el preview
          const res4 = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${dataset_id}/preview`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (res4.ok) {
            const { preview } = await res4.json();
            setPreview(preview);
          }
        }
      }
    }, 2000);
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input 
          type="file" 
          onChange={e => {
            setFile(e.target.files?.[0] ?? null);
            setPreview([]);         // limpia preview en cada nuevo upload
            setStatus("idle");
          }} 
        />
        <button type="submit" disabled={!file || status === "pending" || status === "processing"}>
          Upload
        </button>
      </form>

      <div style={{ marginTop: 16 }}>
        <strong>Dataset ID:</strong> {datasetId || "-"}
      </div>
      <div>
        <strong>Status:</strong> {status}
      </div>

      {status === "ready" && preview.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>Preview (primeras filas)</h3>
          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                {Object.keys(preview[0]).map(col => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((val, j) => (
                    <td key={j}>{String(val)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
