
// app/knowledge/page.tsx
"use client";

import { useAuth } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import UploadDataset from "@/src/components/UploadDataset";
import UploadDocument from "@/src/components/UploadDocument"; // ← NUEVO


/* ---------------------- Tipos /query/run ---------------------- */
type Steps = { engine: string; dataset_version: string; sql_or_code: string };
type QueryRunResp = {
  title: string;
  kind: "table" | "summary";
  data: Record<string, any>[];
  steps?: Steps;
  dry_run?: boolean;
  explain?: any;
};

/* ---------------------- Tipos /chat ---------------------- */
type Intent = "sql" | "mixed" | "semantic";
type RetrievalItem = { column_id: string; score: number; original_name: string };
type TableData = { columns: string[]; rows: Record<string, any>[] };
type ChartSuggestion = { type: "line" | "bar"; x: string; y: string[] };

type ChatResp = {
  intent: Intent;
  answer?: string | null;
  sql?: string | null;
  table?: TableData | null;
  retrieval?: RetrievalItem[] | null;
  needs_disambiguation?: boolean | null;
  candidates?: string[] | null;
  chart_suggestion?: ChartSuggestion | null;
  detail?: string | null;
};

export default function Knowledge() {
  const { getToken } = useAuth();

  /* ---------------------- Runner de /query/run ---------------------- */
  const [datasetId, setDatasetId] = useState("");
  const [sql, setSql] = useState("SELECT * FROM ds LIMIT 20");
  const [res, setRes] = useState<QueryRunResp | null>(null);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>();

  const canRun = useMemo(
    () => Boolean(datasetId && sql && !loading),
    [datasetId, sql, loading]
  );

  async function runQuery() {
    setLoading(true);
    setErr(undefined);
    setRes(null);
    setRows([]);
    setCols([]);

    try {
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");

      const r = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/query/run`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dataset_id: datasetId,
            query_text: sql,
            row_limit: 200,
            engine: "duckdb",
            dry_run: false,
          }),
        }
      );

      const data: QueryRunResp = await r.json();
      if (!r.ok) throw new Error((data as any)?.detail ?? JSON.stringify(data));

      setRes(data);
      const _rows = data.data ?? [];
      const _cols = _rows.length ? Object.keys(_rows[0]) : [];
      setRows(_rows);
      setCols(_cols);
    } catch (e: any) {
      setErr(e.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    runQuery();
  }

  /* ---------------------- Chat /chat ---------------------- */
  const [message, setMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatErr, setChatErr] = useState<string>();
  const [chatResp, setChatResp] = useState<ChatResp | null>(null);

  const canAsk = useMemo(
    () => Boolean(datasetId && message && !chatLoading),
    [datasetId, message, chatLoading]
  );

  async function callChat(extra?: { force_columns?: string[] }) {
    setChatLoading(true);
    setChatErr(undefined);
    setChatResp(null);
    try {
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");

      const r = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: datasetId, message, ...(extra ?? {}) }),
      });
      const data: ChatResp = await r.json();
      if (!r.ok) throw new Error((data as any)?.detail ?? JSON.stringify(data));
      setChatResp(data);
    } catch (e: any) {
      setChatErr(e.message ?? "Error");
    } finally {
      setChatLoading(false);
    }
  }

  function onAsk(e: React.FormEvent) {
    e.preventDefault();
    callChat();
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-black">Knowledge Base</h1>

      {/* Subir dataset */}
      <section className="space-y-3">
        {/* <h2 className="text-xl font-semibold text-black">Subir dataset</h2> */}
        {/* <UploadDataset /> */}
      </section>

      {/* Subir documento (PDF/DOCX) */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-black">Subir documento (PDF/DOCX)</h2>
        <UploadDocument />
      </section>

      {/* Runner rápido de /query/run */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-black">
          Probar consultas (/query/run)
        </h2>

        <form onSubmit={onSubmit} className="space-y-2">
          <input
            className="border px-2 py-1 text-black w-full"
            placeholder="Dataset ID (UUID) — cópialo del uploader de arriba"
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
          />
          <textarea
            className="border px-2 py-1 text-black w-full h-36"
            placeholder='Ej: SELECT COUNT(*) AS n FROM ds'
            value={sql}
            onChange={(e) => setSql(e.target.value)}
          />
          <button
            className="border px-3 py-1 text-black disabled:opacity-50"
            type="submit"
            disabled={!canRun}
          >
            {loading ? "Ejecutando..." : "Ejecutar SQL"}
          </button>
        </form>

        {res?.steps && (
          <div className="text-black space-y-1">
            <div className="text-sm opacity-80">
              <strong>Motor:</strong> {res.steps.engine} ·{" "}
              <strong>Versión:</strong> {res.steps.dataset_version}
            </div>
            <div>
              <strong>SQL ejecutado:</strong>
              <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-gray-100 p-3 text-sm">
                {res.steps.sql_or_code}
              </pre>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="text-black">
            <strong>Resultado:</strong>
            <div className="mt-2 overflow-auto border rounded">
              <table className="min-w-[700px] w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    {cols.map((c) => (
                      <th key={c} className="text-left p-2 border-b">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      {cols.map((c) => (
                        <td key={c} className="p-2 border-b align-top">
                          {String(row[c] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {err && (
          <div className="text-red-600">
            <strong>Error:</strong> {err}
          </div>
        )}
      </section>

      {/* Chat contra el dataset */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-black">Preguntar al dataset (/chat)</h2>

        <form onSubmit={onAsk} className="space-y-2">
          <div className="flex gap-2">
            <input
              className="border px-2 py-1 text-black w-80"
              placeholder="Dataset ID (UUID)"
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
            />
            <input
              className="border px-2 py-1 text-black flex-1"
              placeholder='Ej: "importe total por mes"'
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              className="border px-3 py-1 text-black disabled:opacity-50"
              type="submit"
              disabled={!canAsk}
            >
              {chatLoading ? "Preguntando..." : "Preguntar"}
            </button>
          </div>
        </form>

        {chatErr && (
          <div className="text-red-600">
            <strong>Error:</strong> {chatErr}
          </div>
        )}

        {chatResp?.needs_disambiguation && chatResp.candidates?.length ? (
          <div className="p-3 border rounded text-black">
            <div className="mb-2 font-medium">¿A qué columna(s) te refieres?</div>
            <div className="flex flex-wrap gap-2">
              {chatResp.candidates.map((c) => (
                <button
                  key={c}
                  className="px-3 py-1 border rounded hover:bg-gray-50"
                  onClick={() => callChat({ force_columns: [c] })}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {chatResp?.answer && (
          <div className="text-black">
            <strong>Explicación:</strong> {chatResp.answer}
          </div>
        )}

        {chatResp?.sql && (
          <div className="text-black">
            <strong>SQL:</strong>
            <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-gray-100 p-3 text-sm">
              {chatResp.sql}
            </pre>
          </div>
        )}

        {chatResp?.retrieval && chatResp.retrieval.length > 0 && (
          <div className="text-black text-sm">
            <strong>Retrieval:</strong>{" "}
            {chatResp.retrieval
              .map((r) => `${r.original_name} (${r.score.toFixed(3)})`)
              .join(" · ")}
          </div>
        )}

        {chatResp?.table && chatResp.table.rows.length > 0 && (
          <div className="text-black">
            <strong>Resultado:</strong>
            <div className="mt-2 overflow-auto border rounded">
              <table className="min-w-[700px] w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    {chatResp.table.columns.map((c) => (
                      <th key={c} className="text-left p-2 border-b">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chatResp.table.rows.map((row, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      {chatResp.table!.columns.map((c) => (
                        <td key={c} className="p-2 border-b align-top">
                          {String(row[c] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
