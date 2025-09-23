"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceRenameDialog } from "@/src/components/WorkspaceRenameDialog";
import type { WorkspaceSummary } from "@/src/hooks/useWorkspaces";

type Workspace = WorkspaceSummary;

type WorkspaceResponse = {
  workspaces: Workspace[];
  current_workspace_id?: string;
};

function buildWorkspaceId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length >= 3) {
    return slug.slice(0, 64);
  }

  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `ws-${crypto.randomUUID().slice(0, 8)}`;
  }

  return `ws-${Date.now()}`;
}

export default function MyWorkspaces() {
  const { getToken } = useAuth();
  const router = useRouter();
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  
  // New workspace form
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");

  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL;

  const fetchWorkspaces = useCallback(async () => {
    if (!backendBase) return;

    try {
      setError(undefined);
      setLoading(true);
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");

      const response = await fetch(`${backendBase}/workspaces/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) throw new Error(await response.text());
      const data: WorkspaceResponse = await response.json();

      const list: Workspace[] = (data.workspaces || []).map((ws) => ({
        ...ws,
        summary: {
          documents_count: ws.summary?.documents_count ?? 0,
          counts_by_status: (ws.summary?.counts_by_status ?? {}) as Workspace['summary']['counts_by_status'],
          pages_total: ws.summary?.pages_total ?? null,
          last_document_at: ws.summary?.last_document_at ?? null,
        },
      }));
      setWorkspaces(list);

      setCurrentWorkspaceId((prev) => {
        if (list.length === 0) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("selected_workspace_id");
          }
          return "";
        }

        const storedSelection = typeof window !== "undefined"
          ? localStorage.getItem("selected_workspace_id")
          : null;

        let nextWorkspaceId = prev;

        if (storedSelection && list.some((ws) => ws.workspace_id === storedSelection)) {
          nextWorkspaceId = storedSelection;
        } else if (data.current_workspace_id && list.some((ws) => ws.workspace_id === data.current_workspace_id)) {
          nextWorkspaceId = data.current_workspace_id;
        } else if (!nextWorkspaceId || !list.some((ws) => ws.workspace_id === nextWorkspaceId)) {
          nextWorkspaceId = list[0].workspace_id;
        }

        if (typeof window !== "undefined") {
          localStorage.setItem("selected_workspace_id", nextWorkspaceId);
        }

        return nextWorkspaceId;
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error cargando espacios de trabajo";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [backendBase, getToken]);
  async function createWorkspace() {
    if (!backendBase || !newWorkspaceName.trim()) return;

    try {
      setCreating(true);
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");

      const workspaceId = buildWorkspaceId(newWorkspaceName);

      const response = await fetch(`${backendBase}/workspaces/${encodeURIComponent(workspaceId)}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newWorkspaceName.trim(),
          description: newWorkspaceDescription.trim() || undefined,
        }),
      });

      if (!response.ok) throw new Error(await response.text());

      await fetchWorkspaces();
      setShowCreateForm(false);
      setNewWorkspaceName("");
      setNewWorkspaceDescription("");
      setCurrentWorkspaceId(workspaceId);
      localStorage.setItem("selected_workspace_id", workspaceId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error creando espacio de trabajo";
      setError(message);
    } finally {
      setCreating(false);
    }
  }

  async function renameWorkspace(workspaceId: string, payload: { name: string; description?: string }) {
    if (!backendBase) throw new Error("Backend no configurado");
    const token = await getToken({ template: "Tensor" });
    if (!token) throw new Error("No hay token de sesión.");

    const res = await fetch(`${backendBase}/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: payload.name,
        description: payload.description ?? undefined,
      }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const updated = await res.json();

    setWorkspaces((prev) =>
      prev.map((ws) =>
        ws.workspace_id === workspaceId
          ? {
              ...ws,
              name: updated.name ?? payload.name,
              description: updated.description ?? payload.description ?? null,
            }
          : ws
      )
    );

    await fetchWorkspaces();
  }

  function selectWorkspace(workspaceId: string) {
    setCurrentWorkspaceId(workspaceId);
    // Store in localStorage for persistence
    localStorage.setItem("selected_workspace_id", workspaceId);
    // Navigate to knowledge page
    router.push("/knowledge");
  }

  function formatDate(dateString?: string | null) {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString ?? "-";
    }
  }

  function formatLastActivity(dateString?: string | null) {
    if (!dateString) return "Sin actividad";
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return "Hace menos de 1 hora";
      if (diffInHours < 24) return `Hace ${diffInHours} horas`;
      if (diffInHours < 168) return `Hace ${Math.floor(diffInHours / 24)} días`;
      return formatDate(dateString);
    } catch {
      return "Fecha inválida";
    }
  }

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mis Espacios de Trabajo</h1>
          <p className="text-gray-600">
            Selecciona un espacio de trabajo para comenzar a trabajar con tus documentos
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={fetchWorkspaces}
              className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded mb-4"></div>
                  <div className="flex justify-between">
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Workspaces Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.workspace_id}
                  className={`bg-white rounded-lg shadow-sm border-2 transition-all duration-200 hover:shadow-md cursor-pointer ${
                    currentWorkspaceId === workspace.workspace_id
                      ? "border-blue-500 ring-2 ring-blue-200"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => selectWorkspace(workspace.workspace_id)}
                >
                  <div className="p-6">
                    {/* Workspace Header */}
                    <div className="flex items-start justify-between mb-4 gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                          {workspace.name ?? workspace.workspace_id}
                        </h3>
                        {workspace.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {workspace.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {currentWorkspaceId === workspace.workspace_id && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingWorkspace(workspace);
                          }}
                          className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                          Renombrar
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <div className="flex items-center">
                        <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                        {workspace.summary.documents_count} documentos
                      </div>
                      <div className="text-xs">
                        {formatLastActivity(workspace.summary.last_document_at)}
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        currentWorkspaceId === workspace.workspace_id
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectWorkspace(workspace.workspace_id);
                      }}
                    >
                      {currentWorkspaceId === workspace.workspace_id ? "Trabajando aquí" : "Seleccionar"}
                    </button>
                  </div>
                </div>
              ))}

              {/* Create New Workspace Card */}
              <div
                className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors cursor-pointer"
                onClick={() => setShowCreateForm(true)}
              >
                <div className="p-6 text-center">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="h-6 w-6 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Crear nuevo espacio
                  </h3>
                  <p className="text-sm text-gray-500">
                    Organiza tus documentos en espacios de trabajo separados
                  </p>
                </div>
              </div>
            </div>

            {/* Empty State */}
            {workspaces.length === 0 && !showCreateForm && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No tienes espacios de trabajo
                </h3>
                <p className="text-gray-500 mb-6">
                  Crea tu primer espacio de trabajo para comenzar a organizar tus documentos
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Crear espacio de trabajo
                </button>
              </div>
            )}
          </>
        )}

        {/* Create Workspace Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Crear nuevo espacio de trabajo
                  </h3>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createWorkspace();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del espacio *
                    </label>
                    <input
                      type="text"
                      required
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Mi espacio de trabajo"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descripción (opcional)
                    </label>
                    <textarea
                      value={newWorkspaceDescription}
                      onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Describe el propósito de este espacio de trabajo..."
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creating || !newWorkspaceName.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {creating ? "Creando..." : "Crear espacio"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {editingWorkspace && (
          <WorkspaceRenameDialog
            open={true}
            workspace={editingWorkspace}
            onClose={() => setEditingWorkspace(null)}
            onSubmit={(payload) => renameWorkspace(editingWorkspace.workspace_id, payload)}
          />
        )}
      </div>
    </div>
  );
}
