import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { DocumentStatus } from '../components/StatusBadge';

const BACKEND_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;
const KNOWN_STATUSES: DocumentStatus[] = [
  'idle',
  'pending',
  'processing',
  'ready_for_embeddings',
  'ready_for_chat',
  'error',
];

export interface WorkspaceSummaryResponse {
  workspaces?: Array<{
    workspace_id: string;
    name?: string | null;
    description?: string | null;
    summary?: {
      documents_count?: number;
      counts_by_status?: Record<string, number>;
      pages_total?: number | null;
      last_document_at?: string | null;
    } | null;
  }>;
}

export interface LegacyWorkspaceOverview {
  workspace_id: string;
  counts_by_status: Record<string, number>;
  recent_documents?: Array<{ id: string; filename: string; status: string; created_at?: string }>;
}

export interface LegacyOverviewResponse {
  workspaces: LegacyWorkspaceOverview[];
}

export interface WorkspaceSummary {
  workspace_id: string;
  name?: string | null;
  description?: string | null;
  summary: {
    documents_count: number;
    counts_by_status: Partial<Record<DocumentStatus, number>>;
    pages_total?: number | null;
    last_document_at?: string | null;
  };
}

type RenamePayload = {
  name: string;
  description?: string;
};

function mapCounts(source?: Record<string, number>): Partial<Record<DocumentStatus, number>> {
  if (!source) return {};
  const mapped: Partial<Record<DocumentStatus, number>> = {};
  KNOWN_STATUSES.forEach((status) => {
    if (source[status] !== undefined) {
      mapped[status] = source[status];
    }
  });
  return mapped;
}

function fromModernResponse(data: WorkspaceSummaryResponse): WorkspaceSummary[] {
  return (data.workspaces ?? []).map((ws) => ({
    workspace_id: ws.workspace_id,
    name: ws.name ?? undefined,
    description: ws.description ?? undefined,
    summary: {
      documents_count: ws.summary?.documents_count ?? 0,
      counts_by_status: mapCounts(ws.summary?.counts_by_status ?? undefined),
      pages_total: ws.summary?.pages_total ?? null,
      last_document_at: ws.summary?.last_document_at ?? null,
    },
  }));
}

function fromLegacyResponse(data: LegacyOverviewResponse): WorkspaceSummary[] {
  return (data.workspaces ?? []).map((ws) => {
    const counts = ws.counts_by_status || {};
    const firstDoc = ws.recent_documents?.[0];
    return {
      workspace_id: ws.workspace_id,
      name: undefined,
      description: undefined,
      summary: {
        documents_count:
          (counts.total as number | undefined) ??
          KNOWN_STATUSES.reduce((acc, key) => acc + (counts[key] ?? 0), 0),
        counts_by_status: mapCounts(counts),
        pages_total: undefined,
        last_document_at: firstDoc?.created_at ?? null,
      },
    };
  });
}

export function useWorkspaces() {
  const { getToken } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();

  const fetchOverview = useCallback(async () => {
    if (!BACKEND_BASE) return;
    try {
      setError(undefined);
      setLoading(true);
      const token = await getToken({ template: 'Tensor' });
      if (!token) throw new Error('No hay token de sesión.');

      const commonOptions: RequestInit = {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      };

      let response = await fetch(`${BACKEND_BASE}/workspaces/me`, commonOptions);
      if (response.status === 404 || response.status === 405) {
        // Fallback a endpoint legacy
        response = await fetch(`${BACKEND_BASE}/me/overview`, commonOptions);
        if (!response.ok) throw new Error(await response.text());
        const legacy: LegacyOverviewResponse = await response.json();
        setWorkspaces(fromLegacyResponse(legacy));
        return;
      }

      if (!response.ok) throw new Error(await response.text());
      const data: WorkspaceSummaryResponse = await response.json();
      setWorkspaces(fromModernResponse(data));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error cargando workspaces';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const renameWorkspace = useCallback(
    async (workspaceId: string, payload: RenamePayload) => {
      if (!BACKEND_BASE) return;
      const trimmedName = payload.name.trim();
      if (!trimmedName) {
        throw new Error('El nombre no puede estar vacío.');
      }

      const token = await getToken({ template: 'Tensor' });
      if (!token) throw new Error('No hay token de sesión.');

      const res = await fetch(`${BACKEND_BASE}/workspaces/${encodeURIComponent(workspaceId)}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          description: payload.description?.trim() || undefined,
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
                name: updated.name ?? trimmedName,
                description: updated.description ?? null,
              }
            : ws
        )
      );
    },
    [getToken]
  );

  return {
    workspaces,
    loading,
    error,
    refetch: fetchOverview,
    renameWorkspace,
  };
}
