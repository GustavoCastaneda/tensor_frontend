"use client";

import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { SourcesPanel } from "@/src/components/SourcesPanel";
import { WorkspaceBreadcrumb } from "@/src/components/WorkspaceBreadcrumb";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputAttachments,
  PromptInputAttachment,
} from "@/src/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/src/components/ai-elements/reasoning";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/src/components/ai-elements/conversation";
import { Message, MessageContent } from "@/src/components/ai-elements/message";
import { Response } from "@/src/components/ai-elements/response";

type Citation = {
  doc_id: string;
  title: string;
  page: number; // base-1
  chunk_seq_range?: string; // e.g., "c.2–3"
  text_snippet: string;
  score: number;
  confidence_badge?: string;
  viewer_link?: string;
};

type ChatResp = {
  answer: string;
  reasoning?: string;
  citations: Citation[];
  meta?: Record<string, unknown>;
  debug?: (Record<string, unknown> & { thinking_summary?: string });
};

type ChatMessageMetadata = {
  citations?: Citation[];
  response?: ChatResp;
  stream?: boolean;
};

type ChatMessage = UIMessage<ChatMessageMetadata>;

export default function ChatPage() {
  const search = useSearchParams();
  const ws = search.get("ws") || "";
  const { getToken } = useAuth();

  // Use AI SDK's useChat hook for streaming
  const {
    messages,
    sendMessage,
    status,
    error: chatError,
    clearError,
  } = useChat<ChatMessage>({
    onFinish: (message) => {
      // Ensure citations are only shown after the message is complete
      console.log('Message finished:', message);
    },
  });
  const [input, setInput] = useState("");
  const [localError, setLocalError] = useState<string | undefined>();

  // Workspace documents for sources panel (fallback when no citations yet)
  type WorkspaceDoc = {
    id: string;
    filename: string;
    status: string;
    pages_count?: number;
    created_at?: string;
  };
  const [wsDocs, setWsDocs] = useState<WorkspaceDoc[]>([]);
  const [wsDocsLoading, setWsDocsLoading] = useState<boolean>(false);
  const [wsDocsError, setWsDocsError] = useState<string | undefined>();

  // Workspace name state
  const [workspaceName, setWorkspaceName] = useState<string | undefined>();
  const [workspaceLoading, setWorkspaceLoading] = useState<boolean>(false);

  const isStreaming = status === "submitted" || status === "streaming";
  const canSend = useMemo(() => Boolean(ws && !isStreaming), [ws, isStreaming]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (message: { text?: string; files?: any[] }, e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;

    const userMessage = message.text?.trim();
    if (!userMessage) return;

    setLocalError(undefined);
    clearError();

    try {
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");

      // Send message using AI SDK
      await sendMessage(
        { text: userMessage },
        {
          body: {
            data: { workspace_id: ws }
          }
        }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error enviando mensaje";
      setLocalError(message);
    }
  };


  async function fetchWorkspaceName() {
    if (!ws) return;
    try {
      setWorkspaceLoading(true);
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/workspaces/${encodeURIComponent(ws)}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });
      
      if (response.ok) {
        const data = await response.json();
        setWorkspaceName(data.name || ws);
      } else {
        // If workspace not found, fallback to workspace_id
        setWorkspaceName(ws);
      }
    } catch (error: unknown) {
      console.error("Error fetching workspace name:", error);
      // Fallback to workspace_id on error
      setWorkspaceName(ws);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function fetchWorkspaceDocs() {
    if (!ws) return;
    try {
      setWsDocsError(undefined);
      setWsDocsLoading(true);
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");
      const qs = new URLSearchParams({ workspace_id: ws, status: "ready_for_chat", limit: "20", offset: "0" });
      const r = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/me/documents?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail ?? JSON.stringify(data));
      const docs = (data.documents ?? data.items ?? []) as WorkspaceDoc[];
      setWsDocs(docs);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error cargando documentos";
      setWsDocsError(message);
    } finally {
      setWsDocsLoading(false);
    }
  }

  useEffect(() => {
    // Preload workspace name and docs
    fetchWorkspaceName();
    fetchWorkspaceDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws]);

  const combinedChatError = localError || chatError?.message;
  const lastMessageId = messages.length ? messages[messages.length - 1]?.id : undefined;

  return (
    <div className="h-screen flex flex-col">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 flex-1 min-h-0">
        {/* Main chat column */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="space-y-2 mb-4">
            <h1 className="text-2xl font-bold text-black">Chat</h1>
            <WorkspaceBreadcrumb
              workspaceName={workspaceName}
              workspaceId={ws}
              isLoading={workspaceLoading}
              currentPage="Chat"
            />
          </div>

          {/* Intent chips */}
          <div className="flex items-center gap-2 mb-4">
            <button className="px-3 py-1.5 rounded-full text-sm bg-blue-600 text-white">Docs</button>
            <button className="px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-400 cursor-not-allowed" disabled>
              SQL
            </button>
            <button className="px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-400 cursor-not-allowed" disabled>
              Mixed
            </button>
          </div>

          {/* Chat Messages - Área con scroll */}
          <div className="flex-1 min-h-0 flex flex-col">
            <Conversation className="flex-1 min-h-0">
              <ConversationContent className="h-full">
            {messages.map((message) => {
              const isUser = message.role === 'user';
              const messageMetadata: ChatMessageMetadata = message.metadata ?? {};
              const responseData = messageMetadata.response;
              const citations = responseData?.citations || messageMetadata.citations || [];
              const isAssistantStreaming =
                message.role === 'assistant' && message.id === lastMessageId && isStreaming;
              const isAssistantComplete = message.role === 'assistant' && !isAssistantStreaming;

              // Filtrar partes de razonamiento
              const reasoningParts = message.parts.filter((part) => part.type === 'reasoning');
              const reasoningStreamingText = reasoningParts
                .map((part) => (part.type === 'reasoning' ? part.text : ''))
                .join('\n\n')
                .trim();
              const finalReasoningText = (responseData?.reasoning ?? '').trim();
              const reasoningText = (isAssistantStreaming ? reasoningStreamingText : finalReasoningText || reasoningStreamingText).trim();
              const hasReasoning = Boolean(reasoningText);
              
              // Filtrar partes de texto (respuesta) - excluir solo reasoning
              const displayParts = message.parts.filter((part) => part.type !== 'reasoning');
              const latencyMs = Number((responseData?.meta as Record<string, unknown>)?.latency_ms ?? NaN);
              const reasoningDurationSeconds = Number.isFinite(latencyMs) && latencyMs > 0
                ? Math.max(1, Math.round(latencyMs / 1000))
                : hasReasoning
                  ? 1
                  : undefined;

              // Debug: verificar qué propiedades tiene el mensaje
              console.log('Message object:', message);
              console.log('Message parts:', message.parts);
              console.log('Display parts:', displayParts);

                return (
                  <Message key={message.id} from={message.role}>
                    <MessageContent>
                      {/* Mostrar razonamiento PRIMERO si existe */}
                      {message.role === 'assistant' && hasReasoning && (
                        <div className="mb-3">
                          <Reasoning
                            isStreaming={isAssistantStreaming}
                            duration={isAssistantStreaming ? undefined : reasoningDurationSeconds}
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{reasoningText}</ReasoningContent>
                          </Reasoning>
                        </div>
                      )}

                      {/* Mostrar indicador de "Escribiendo..." solo si no hay razonamiento */}
                      {isAssistantStreaming && !hasReasoning && (
                        <div className="mb-2 text-sm text-gray-500">Escribiendo...</div>
                      )}

                      {/* Mostrar la respuesta DESPUÉS del razonamiento */}
                      <div className="whitespace-pre-wrap space-y-2">
                        {displayParts.length > 0 ? (
                          displayParts.map((part, i: number) => {
                            switch (part.type) {
                              case 'text':
                                return (
                                  <Response key={`${message.id}-${part.type}-${i}`}>
                                    {part.text}
                                  </Response>
                                );
                              default:
                                return null;
                            }
                          })
                        ) : (
                          // Fallback: mostrar mensaje si no hay partes de texto
                          <Response>No hay contenido disponible</Response>
                        )}
                      </div>

                    {isAssistantComplete && responseData?.debug?.thinking_summary && (
                      <div className="mt-3 text-xs text-gray-500">
                        {responseData.debug.thinking_summary}
                      </div>
                    )}
                  </MessageContent>
                </Message>
              );
            })}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            {/* Input Form - Fijo en la parte inferior */}
            <div className="mt-4">
              <PromptInput
                onSubmit={handleSubmit}
                className="w-full border border-gray-300 rounded-3xl divide-y !divide-gray-300"
              >
                <PromptInputBody>
                  <PromptInputAttachments>
                    {(attachment) => (
                      <PromptInputAttachment
                        data={attachment}
                        className="h-14 w-14"
                      />
                    )}
                  </PromptInputAttachments>
                  <PromptInputTextarea
                    placeholder="Escribe tu pregunta..."
                    disabled={isStreaming}
                  />
                </PromptInputBody>
                <PromptInputToolbar>
                  <PromptInputTools>
                    {/* Aquí puedes agregar herramientas adicionales si las necesitas */}
                  </PromptInputTools>
                  <PromptInputSubmit
                    status={isStreaming ? "streaming" : status}
                    disabled={!canSend}
                  />
                </PromptInputToolbar>
              </PromptInput>

              {/* Error */}
              {combinedChatError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 mt-2">
                  {combinedChatError || "Error en el chat"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sources panel */}
        <SourcesPanel
          wsDocs={wsDocs}
          wsDocsLoading={wsDocsLoading}
          wsDocsError={wsDocsError}
          onRefresh={fetchWorkspaceDocs}
        />
      </div>
    </div>
  );
}
