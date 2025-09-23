"use client";

import { useEffect, useState } from "react";
import type { WorkspaceSummary } from "../hooks/useWorkspaces";

interface WorkspaceRenameDialogProps {
  open: boolean;
  workspace: WorkspaceSummary;
  onClose: () => void;
  onSubmit: (payload: { name: string; description?: string }) => Promise<void> | void;
}

export function WorkspaceRenameDialog({ open, workspace, onClose, onSubmit }: WorkspaceRenameDialogProps) {
  const [name, setName] = useState<string>(workspace.name ?? "");
  const [description, setDescription] = useState<string>(workspace.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setName(workspace.name ?? "");
      setDescription(workspace.description ?? "");
      setError(undefined);
    }
  }, [open, workspace.name, workspace.description]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("El nombre no puede estar vacío");
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit({ name: trimmed, description: description.trim() || undefined });
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error guardando cambios";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Editar workspace</h3>
          <p className="mt-1 text-sm text-gray-600">
            Cambia el nombre y la descripción visibles para el workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="workspace-name">
              Nombre
            </label>
            <input
              id="workspace-name"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Nombre visible del workspace"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="workspace-description">
              Descripción (opcional)
            </label>
            <textarea
              id="workspace-description"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={240}
              rows={3}
              placeholder="Breve descripción del contenido del workspace"
            />
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
