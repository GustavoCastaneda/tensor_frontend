import React from 'react';
import { useDashboardChat } from '../hooks/useDashboardChat';

export function DashboardChatForm() {
  const {
    datasetId,
    setDatasetId,
    message,
    setMessage,
    loading,
    error,
    canSend,
    handleSend,
  } = useDashboardChat();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-black">Probar /chat</h1>

      <form onSubmit={handleSend} className="space-y-3">
        <input
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Dataset ID (UUID)"
          value={datasetId}
          onChange={(e) => setDatasetId(e.target.value)}
        />
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder='Ej: "Importe total por mes"'
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          type="submit"
          disabled={!canSend}
        >
          {loading ? "Enviando..." : "Enviar a /chat"}
        </button>
      </form>

      {error && (
        <div className="text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
