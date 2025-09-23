import React from 'react';
import { WorkspaceCard } from './WorkspaceCard';
import { useWorkspaces } from '../hooks/useWorkspaces';

export function WorkspaceOverview() {
  const { workspaces, loading, error, refetch, renameWorkspace } = useWorkspaces();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-normal text-gray-700">My Workspaces</h2>
        <button
          onClick={refetch}
          className="text-sm px-3 py-1.5 bg-[#008ace] hover:bg-gray-200 rounded-md text-white transition-colors"
        >
          Actualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-6 bg-gray-200 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.workspace_id}
              workspace={workspace}
              onRename={renameWorkspace}
            />
          ))}
          {workspaces.length === 0 && !loading && !error && (
            <div className="col-span-full text-sm text-gray-600 text-center py-8">
              No hay workspaces disponibles.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
