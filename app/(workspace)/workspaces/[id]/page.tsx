"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

export default function WorkspaceDetails() {
  const router = useRouter();
  const search = useSearchParams();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [counts, setCounts] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);

  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL;
  const workspaceId = decodeURIComponent((router as any)?.query?.id || "");

  useEffect(() => {
    const idFromUrl = window.location.pathname.split("/").pop() || "";
    const ws = decodeURIComponent(idFromUrl);
    if (!ws) return;

    async function load() {
      if (!backendBase) return;
      try {
        setLoading(true);
        setError(undefined);
        const token = await getToken({ template: "Tensor" });
        if (!token) throw new Error("No hay token de sesión.");
        const r = await fetch(`${backendBase}/me/overview`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
          cache: "no-store",
        });
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();
        const found = (data?.workspaces || []).find((w: any) => w.workspace_id === ws);
        setCounts(found?.counts_by_status || null);
        setRecent(found?.recent_documents || []);
      } catch (e: any) {
        setError(e.message || "Error cargando workspace");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [backendBase, getToken]);

  const wsIdFromPath = typeof window !== "undefined" ? decodeURIComponent(window.location.pathname.split("/").pop() || "") : "";

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black">Workspace</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/chat?ws=${encodeURIComponent(wsIdFromPath)}`)}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Ir a Chat
          </button>
        </div>
      </div>

      <code className="text-xs text-gray-600">{wsIdFromPath}</code>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="h-24 bg-gray-100 rounded animate-pulse" />
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium text-black mb-2">Resumen</h2>
            <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto">{JSON.stringify(counts, null, 2)}</pre>
          </div>
          <div>
            <h2 className="text-lg font-medium text-black mb-2">Documentos recientes</h2>
            {recent?.length ? (
              <ul className="list-disc pl-6 text-sm text-black space-y-1">
                {recent.map((d) => (
                  <li key={d.id}>{d.filename}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-600">Sin documentos recientes</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}






