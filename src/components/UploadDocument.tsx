"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

type DocumentStatus =
  | "idle"
  | "pending"                // subiendo a Storage
  | "processing"             // extrayendo texto + chunking
  | "ready_for_embeddings"   // chunks listos (embeddings encolados o hechos)
  | "ready_for_chat"         // embeddings OK
  | "error";

type DocPreview = { page: number; chunk: number; content: string };

export default function UploadDocument() {
  const { getToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [docId, setDocId] = useState<string>();
  const [status, setStatus] = useState<DocumentStatus>("idle");
  const [preview, setPreview] = useState<DocPreview[]>([]);
  const [error, setError] = useState<string>();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setError("Formato no soportado. Sube un PDF o DOCX.");
      return;
    }

    setStatus("pending");

    try {
      // 1) JWT
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");

      // 2) Presigned URL
      const r1 = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/documents/upload-url?filename=${encodeURIComponent(file.name)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!r1.ok) throw new Error(await r1.text());
      const { upload_url, document_id } = await r1.json();
      setDocId(document_id);

      // 3) Subir a Storage
      const r2 = await fetch(upload_url, { method: "PUT", body: file });
      if (!r2.ok) throw new Error("Falló la subida a Storage");
      setStatus("processing");

      // 4) Polling de status
      const intervalId = window.setInterval(async () => {
        try {
          const st = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/documents/${document_id}/status`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!st.ok) return;
          const data = await st.json();
          const docStatus = data.status as DocumentStatus;
          setStatus(docStatus);

          // 5) Cargar preview una sola vez cuando ya haya chunks
          if (
            (docStatus === "ready_for_embeddings" || docStatus === "ready_for_chat") &&
            preview.length === 0
          ) {
            const rPrev = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}/documents/${document_id}/preview?full=1`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (rPrev.ok) {
              const { preview } = await rPrev.json();
              setPreview(preview || []);
            }
          }

          // 6) Detener polling cuando finaliza o error
          if (docStatus === "ready_for_chat" || docStatus === "error") {
            window.clearInterval(intervalId);
          }
        } catch {
          /* swallow */
        }
      }, 2500);
    } catch (e: any) {
      setError(e.message || "Error desconocido");
      setStatus("error");
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Subir Documento</h2>
        <p className="text-gray-600">Sube un PDF o DOCX para procesarlo y generar embeddings</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar archivo
            </label>
            <input
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-300 rounded-lg cursor-pointer bg-gray-50"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview([]);
                setStatus("idle");
                setDocId(undefined);
                setError(undefined);
              }}
            />
          </div>
          <button
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
            type="submit"
            disabled={!file || status === "pending" || status === "processing"}
          >
            {status === "pending" || status === "processing" ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Procesando...
              </>
            ) : (
              "Subir"
            )}
          </button>
        </div>
      </form>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500 mb-1">Document ID</div>
          <div className="text-sm text-gray-900 font-mono break-all">
            {docId || "-"}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500 mb-1">Estado</div>
          <div className="text-sm text-gray-900 capitalize">
            {status === "idle" && "Esperando"}
            {status === "pending" && "Subiendo"}
            {status === "processing" && "Procesando"}
            {status === "ready_for_embeddings" && "Generando embeddings"}
            {status === "ready_for_chat" && "Listo"}
            {status === "error" && "Error"}
          </div>
        </div>
      </div>

      {/* Loading Animation */}
      {(status === "pending" || status === "processing") && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg
              className="h-6 w-6 animate-spin text-blue-600"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <div>
              <div className="font-medium text-blue-900">
                {status === "pending"
                  ? "Subiendo documento al servidor..."
                  : "Procesando documento y generando chunks..."}
              </div>
              <div className="text-sm text-blue-700">
                {status === "pending"
                  ? "Esto puede tomar unos segundos"
                  : "Esto puede tomar varios minutos"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium text-red-900">Error</div>
              <div className="text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Skeleton Loading for Preview */}
      {status === "processing" && preview.length === 0 && (
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4"></div>
          <div className="space-y-2">
            <div className="h-20 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-20 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-20 rounded-lg bg-gray-200 animate-pulse" />
          </div>
        </div>
      )}

      {/* Preview Section */}
      {preview.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Vista previa del contenido</h3>
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {preview.length} chunks
            </span>
          </div>
          <div className="space-y-4">
            {preview.map((p, i) => (
              <div key={`${p.page}-${p.chunk}-${i}`} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <span className="bg-gray-100 px-2 py-1 rounded">Página {p.page}</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">Chunk {p.chunk}</span>
                </div>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                  {p.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Message */}
      {status === "ready_for_chat" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
          <div className="flex items-center gap-3">
            <svg className="h-6 w-6 text-green-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium text-green-900">¡Documento procesado exitosamente!</div>
              <div className="text-sm text-green-700">El documento está listo para chatear</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

