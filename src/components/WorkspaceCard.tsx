import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge, DocumentStatus } from './StatusBadge';
import type { WorkspaceSummary } from '../hooks/useWorkspaces';
import { WorkspaceRenameDialog } from './WorkspaceRenameDialog';


interface WorkspaceCardProps {
  workspace: WorkspaceSummary;
  onRename?: (workspaceId: string, payload: { name: string; description?: string }) => Promise<void>;
}

export function WorkspaceCard({ workspace, onRename }: WorkspaceCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const total = useMemo(() => {
    const manual = Object.values(workspace.summary.counts_by_status).reduce<number>((acc, n) => acc + (n ?? 0), 0);
    return workspace.summary.documents_count || manual;
  }, [workspace.summary.counts_by_status, workspace.summary.documents_count]);

  const statusKeys: DocumentStatus[] = ['idle', 'pending', 'processing', 'ready_for_embeddings', 'ready_for_chat', 'error'];

  const lastActivity = workspace.summary.last_document_at
    ? new Date(workspace.summary.last_document_at)
    : null;

  const handleRename = useCallback(
    async (payload: { name: string; description?: string }) => {
      if (!onRename) return;
      await onRename(workspace.workspace_id, payload);
    },
    [onRename, workspace.workspace_id]
  );

  return (
    <div className="relative text-left border border-black rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            {workspace.name ?? 'Workspace'}
          </div>
        </div>
        {onRename && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Editar
          </button>
        )}
      </div>

      {workspace.description && (
        <p className="mt-2 text-xs text-gray-600 line-clamp-3">{workspace.description}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {statusKeys.map((status) => (
          <StatusBadge
            key={status}
            status={status}
            count={workspace.summary.counts_by_status[status] || 0}
          />
        ))}
        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
          Total: {total}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-1 text-xs text-gray-500">
        <div>
          Última actividad:{' '}
          {lastActivity ? lastActivity.toLocaleString('es-ES') : 'Sin actividad'}
        </div>
        {workspace.summary.pages_total !== undefined && workspace.summary.pages_total !== null && (
          <div>Páginas acumuladas: {workspace.summary.pages_total}</div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => router.push(`/chat?ws=${encodeURIComponent(workspace.workspace_id)}`)}
          className="px-3 py-1.5 text-sm rounded-md bg-[#008ace] text-white hover:bg-curious-blue-700 transition-colors"
        >
          Abrir chat
        </button>
        <button
          onClick={() => router.push(`/workspaces/${encodeURIComponent(workspace.workspace_id)}`)}
          className="px-3 py-1.5 text-sm rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
        >
          Ver detalles
        </button>
      </div>

      {onRename && (
        <WorkspaceRenameDialog
          open={isEditing}
          workspace={workspace}
          onClose={() => setIsEditing(false)}
          onSubmit={handleRename}
        />
      )}
    </div>
  );
}
