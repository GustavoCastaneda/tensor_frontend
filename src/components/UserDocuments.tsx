"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";

type DocumentStatus =
  | "idle"
  | "pending"
  | "processing"
  | "ready_for_embeddings"
  | "ready_for_chat"
  | "error";

type UserDoc = {
  id: string;
  filename: string;
  workspace_id: string;
  status: DocumentStatus;
  pages_count: number;
  text_chars: number;
  formulas_count: number;
  created_at: string;
};

type CountsByStatus = Partial<Record<DocumentStatus, number>> & {
  total?: number;
};

type DocumentsResponse = {
  items?: UserDoc[];
  documents?: UserDoc[];
  counts_by_status?: CountsByStatus;
  user_id?: string;
  workspace_id?: string | null;
};

type WorkspaceOverview = {
  workspace_id: string;
  counts_by_status: CountsByStatus;
  recent_documents: UserDoc[]; // up to 10
};

type OverviewResponse = {
  workspaces: WorkspaceOverview[];
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  idle: "Esperando",
  pending: "Subiendo",
  processing: "Procesando",
  ready_for_embeddings: "Generando embeddings",
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

function formatDate(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function decodeJwt(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export default function UserDocuments() {
  const { getToken } = useAuth();

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();

  const [overviewLoading, setOverviewLoading] = useState<boolean>(false);
  const [overviewError, setOverviewError] = useState<string | undefined>();

  const [documents, setDocuments] = useState<UserDoc[]>([]);
  const [counts, setCounts] = useState<CountsByStatus | undefined>();
  const [overview, setOverview] = useState<OverviewResponse | undefined>();
  const [debugNote, setDebugNote] = useState<string>("");
  const [debugRaw, setDebugRaw] = useState<any>(null);
  const [jwtSub, setJwtSub] = useState<string | undefined>();
  const [jwtUserId, setJwtUserId] = useState<string | undefined>();
  const [jwtExp, setJwtExp] = useState<number | undefined>();
  const [expectedUserId, setExpectedUserId] = useState<string>("");
  const [meResponse, setMeResponse] = useState<any>(null);
  const [meError, setMeError] = useState<string | undefined>();

  // Filters
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [status, setStatus] = useState<"" | DocumentStatus>("");
  const [limit, setLimit] = useState<number>(20);
  const [offset, setOffset] = useState<number>(0);

  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL;

  // Derived
  const canGoPrev = offset > 0;
  const canGoNext = documents.length === limit; // heuristic without total

  const availableWorkspaces = useMemo(() => {
    const ids = new Set<string>();
    overview?.workspaces?.forEach((w) => ids.add(w.workspace_id));
    // include any workspace ids seen in current docs as well
    documents.forEach((d) => ids.add(d.workspace_id));
    return Array.from(ids);
  }, [overview, documents]);

  async function fetchOverview() {
    if (!backendBase) return;
    try {
      setOverviewError(undefined);
      setOverviewLoading(true);
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");
      const r = await fetch(`${backendBase}/me/overview`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) throw new Error(await r.text());
      const data: OverviewResponse = await r.json();
      setOverview(data);
    } catch (e: any) {
      setOverviewError(e.message || "Error cargando overview");
    } finally {
      setOverviewLoading(false);
    }
  }

  async function fetchDocuments() {
    if (!backendBase) return;
    try {
      setError(undefined);
      setLoading(true);
      setDebugNote("");
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");

      async function requestDocs(query: Record<string, string | number | undefined>) {
        const qs = new URLSearchParams();
        Object.entries(query).forEach(([k, v]) => {
          if (v !== undefined && v !== "") qs.set(k, String(v));
        });
        const res = await fetch(`${backendBase}/me/documents?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as DocumentsResponse;
      }

      const baseQuery = {
        workspace_id: workspaceId || undefined,
        status: status || undefined,
        limit,
        offset,
      } as Record<string, string | number | undefined>;

      // 1) Intento principal
      let data = await requestDocs(baseQuery);
      let note = "principal";
      let raw: any = { attempt: note, query: baseQuery, response: data };

      // 2) Si no hay items y hay conteo del estado seleccionado, probamos alias de estado
      const selectedStatusCount = status ? (data.counts_by_status?.[status as DocumentStatus] || 0) : 0;
      const statusAliases: Record<DocumentStatus, string[]> = {
        idle: ["idle"],
        pending: ["pending"],
        processing: ["processing", "indexing", "processing_text"],
        ready_for_embeddings: ["ready_for_embeddings", "embeddings_ready", "embedded"],
        ready_for_chat: ["ready_for_chat", "ready", "completed", "done"],
        error: ["error", "failed"]
      };

      if ((data.items?.length ?? 0) === 0 && status && selectedStatusCount > 0) {
        const aliases = statusAliases[status as DocumentStatus] || [status as string];
        for (const alias of aliases) {
          if (alias === status) continue;
          const q = { ...baseQuery, status: alias } as Record<string, string | number | undefined>;
          data = await requestDocs(q);
          note = `fallback:status=${alias}`;
          raw = { attempt: note, query: q, response: data };
          if ((data.items?.length ?? 0) > 0) break;
        }
      }

      // 3) Si sigue vacío, probamos alias de parámetro de workspace
      if ((data.items?.length ?? 0) === 0 && workspaceId) {
        const workspaceParams = ["workspace_id", "workspaceId", "workspace", "ws_id", "wsid"];
        for (const wp of workspaceParams) {
          const q: Record<string, string | number | undefined> = { [wp]: workspaceId, status, limit, offset } as any;
          data = await requestDocs(q);
          note = note.startsWith("fallback") ? `${note} + workspace param=${wp}` : `fallback:workspace param=${wp}`;
          raw = { attempt: note, query: q, response: data };
          if ((data.items?.length ?? 0) > 0) break;
        }
      }

      // 4) Si sigue vacío, probamos solo estado
      if ((data.items?.length ?? 0) === 0 && status) {
        const statusParams = ["status", "state", "doc_status"];
        for (const sp of statusParams) {
          const q: Record<string, string | number | undefined> = { [sp]: status, limit, offset } as any;
          data = await requestDocs(q);
          note = note.startsWith("fallback") ? `${note} + solo ${sp}` : `fallback:solo ${sp}`;
          raw = { attempt: note, query: q, response: data };
          if ((data.items?.length ?? 0) > 0) break;
        }
      }

      // 5) Si sigue vacío, probamos solo workspace
      if ((data.items?.length ?? 0) === 0 && workspaceId) {
        const workspaceParams = ["workspace_id", "workspaceId", "workspace", "ws_id", "wsid"];
        for (const wp of workspaceParams) {
          const q: Record<string, string | number | undefined> = { [wp]: workspaceId, limit, offset } as any;
          data = await requestDocs(q);
          note = note.startsWith("fallback") ? `${note} + solo ${wp}` : `fallback:solo ${wp}`;
          raw = { attempt: note, query: q, response: data };
          if ((data.items?.length ?? 0) > 0) break;
        }
      }

      // 6) Último intento: sin filtros
      if ((data.items?.length ?? 0) === 0) {
        const q: Record<string, string | number | undefined> = { limit, offset };
        data = await requestDocs(q);
        note = note ? `${note} + sin filtros` : "fallback:sin filtros";
        raw = { attempt: note, query: q, response: data };
      }

      setDocuments(data.documents ?? data.items ?? []);
      setCounts(data.counts_by_status ?? undefined);
      setDebugNote(note);
      setDebugRaw(raw);
    } catch (e: any) {
      setError(e.message || "Error cargando documentos");
    } finally {
      setLoading(false);
    }
  }

  // Initial loads
  useEffect(() => {
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, status, limit, offset]);

  function resetPagination() {
    setOffset(0);
  }

  async function verifyJwt() {
    try {
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");
      const payload = decodeJwt(token);
      setJwtSub(payload?.sub ?? undefined);
      setJwtUserId(payload?.user_id ?? payload?.clerk_user_id ?? undefined);
      setJwtExp(payload?.exp ?? undefined);
    } catch (e: any) {
      setJwtSub(undefined);
      setJwtUserId(undefined);
      setJwtExp(undefined);
    }
  }

  async function testMe() {
    if (!backendBase) return;
    try {
      setMeError(undefined);
      setMeResponse(null);
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");
      const r = await fetch(`${backendBase}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });
      const txt = await r.text();
      try {
        const json = JSON.parse(txt);
        setMeResponse(json);
      } catch {
        setMeResponse(txt);
      }
      if (!r.ok) throw new Error(typeof meResponse === "string" ? meResponse : JSON.stringify(meResponse));
    } catch (e: any) {
      setMeError(e.message || "Error en /me");
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Mis documentos</h2>
        <p className="text-gray-600">Consulta y filtra tus documentos cargados.</p>
      </div>

      {/* Overview by workspace */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Resumen por espacio de trabajo</h3>
          <button
            onClick={fetchOverview}
            className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-800"
          >
            Actualizar
          </button>
        </div>
        {overviewLoading ? (
          <div className="h-20 rounded bg-gray-100 animate-pulse" />
        ) : overviewError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {overviewError}
          </div>
        ) : overview && overview.workspaces?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {overview.workspaces.map((w) => {
              const total =
                (w.counts_by_status.total ?? 0) ||
                Object.values(w.counts_by_status).reduce<number>((acc, n) => acc + (n || 0), 0);
              return (
                <div key={w.workspace_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-gray-900">Espacio de trabajo</div>
                    <code className="text-xs text-gray-500">{w.workspace_id}</code>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => {
                      const k = key as DocumentStatus;
                      const count = w.counts_by_status[k] || 0;
                      if (!count) return null;
                      return (
                        <span
                          key={k}
                          className={`text-xs px-2 py-1 rounded ${STATUS_BADGE_CLASSES[k]}`}
                        >
                          {label}: {count}
                        </span>
                      );
                    })}
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">Total: {total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setWorkspaceId(w.workspace_id);
                        resetPagination();
                      }}
                      className="text-sm text-blue-700 hover:underline"
                    >
                      Filtrar por este espacio
                    </button>
                    {w.recent_documents?.length ? (
                      <div className="text-xs text-gray-500">{w.recent_documents.length} documentos recientes</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-600">Aún no hay datos del resumen.</div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Espacio de trabajo</label>
          <select
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
            value={workspaceId}
            onChange={(e) => {
              setWorkspaceId(e.target.value);
              resetPagination();
            }}
          >
            <option value="">Todos</option>
            {availableWorkspaces.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as any);
              resetPagination();
            }}
          >
            <option value="">Todos</option>
            {(Object.keys(STATUS_LABELS) as DocumentStatus[]).map((k) => (
              <option key={k} value={k}>
                {STATUS_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Por página</label>
          <select
            className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              resetPagination();
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="md:ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              resetPagination();
              fetchDocuments();
            }}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Refrescar
          </button>
          {loading && (
            <svg className="h-5 w-5 animate-spin text-gray-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
        </div>
      </div>

      {/* Counts summary */}
      <div className="mb-4 flex flex-wrap gap-2">
        {counts ? (
          <>
            {(Object.keys(STATUS_LABELS) as DocumentStatus[]).map((k) => (
              <span key={k} className={`text-xs px-2 py-1 rounded ${STATUS_BADGE_CLASSES[k]}`}>
                {STATUS_LABELS[k]}: {counts[k] || 0}
              </span>
            ))}
            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
              Total: {counts.total ?? Object.values(counts).reduce<number>((acc, n) => acc + (typeof n === "number" ? n : 0), 0)}
            </span>
          </>
        ) : (
          <span className="text-sm text-gray-500">Sin resumen disponible</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Archivo</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Espacio</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Estado</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Páginas</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Caracteres</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Fórmulas</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Creado el</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6">
                  <div className="h-6 bg-gray-100 rounded animate-pulse w-1/2 mb-2"></div>
                  <div className="h-6 bg-gray-100 rounded animate-pulse w-1/3"></div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-4 py-4">
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-sm text-gray-500">No hay documentos que coincidan con los filtros.</td>
              </tr>
            ) : (
              documents.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="text-sm text-gray-900 truncate max-w-[320px]" title={d.filename}>{d.filename}</div>
                    <div className="text-xs text-gray-500">ID: {d.id}</div>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    <code className="text-xs text-gray-600">{d.workspace_id}</code>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_BADGE_CLASSES[d.status]}`}>{STATUS_LABELS[d.status]}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-sm text-gray-700">{d.pages_count ?? 0}</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-700">{d.text_chars ?? 0}</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-700">{d.formulas_count ?? 0}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{formatDate(d.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Debug Panel */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-gray-600">Debug API</summary>
        <div className="mt-2 text-xs text-gray-700 space-y-1">
          <div><strong>Backend:</strong> {backendBase}</div>
          <div>
            <strong>Query:</strong> {`workspace_id=${workspaceId || ""}&status=${status || ""}&limit=${limit}&offset=${offset}`}
          </div>
          <div><strong>Docs recibidos:</strong> {documents.length}</div>
          <div><strong>Counts:</strong> {JSON.stringify(counts)}</div>
          {debugNote && <div><strong>Fallback:</strong> {debugNote}</div>}
          {debugRaw && (
            <>
              <div><strong>Query usado:</strong> {JSON.stringify(debugRaw.query)}</div>
              <div className="overflow-auto max-h-64 border rounded p-2 bg-gray-50">
                <pre>{JSON.stringify(debugRaw.response, null, 2)}</pre>
              </div>
            </>
          )}
          <div className="overflow-auto max-h-64 border rounded p-2 bg-gray-50">
            <pre>{JSON.stringify(documents.slice(0, 3), null, 2)}</pre>
          </div>
          <div className="mt-3 pt-2 border-t">
            <div className="mb-2 font-medium">JWT y autenticación</div>
            <div className="flex flex-wrap items-end gap-2 mb-2">
              <div>
                <label className="block mb-1">user_id esperado</label>
                <input
                  className="border px-2 py-1 rounded"
                  placeholder="user_..."
                  value={expectedUserId}
                  onChange={(e) => setExpectedUserId(e.target.value)}
                />
              </div>
              <button onClick={verifyJwt} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Verificar JWT</button>
              <button onClick={testMe} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Probar /me</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2 bg-gray-50 rounded border">
                <div><strong>JWT sub:</strong> {jwtSub || "-"}</div>
                <div><strong>JWT user_id:</strong> {jwtUserId || "-"}</div>
                <div><strong>JWT exp:</strong> {jwtExp ? new Date(jwtExp * 1000).toLocaleString() : "-"}</div>
                {expectedUserId && (
                  <div className={"mt-1 " + ((jwtSub === expectedUserId || jwtUserId === expectedUserId) ? "text-green-700" : "text-red-700") }>
                    Coincide con esperado: {(jwtSub === expectedUserId || jwtUserId === expectedUserId) ? "Sí" : "No"}
                  </div>
                )}
              </div>
              <div className="p-2 bg-gray-50 rounded border">
                <div className="mb-1"><strong>/me respuesta</strong></div>
                {meError && <div className="text-red-700">{meError}</div>}
                {meResponse && (
                  <div className="overflow-auto max-h-40">
                    <pre>{typeof meResponse === "string" ? meResponse : JSON.stringify(meResponse, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </details>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">Offset: {offset} · Límite: {limit}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            disabled={!canGoPrev}
            className="px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <button
            onClick={() => setOffset((o) => o + limit)}
            disabled={!canGoNext}
            className="px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}


