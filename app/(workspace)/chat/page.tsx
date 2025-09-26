"use client";

import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { GlobeIcon, MicIcon, PaperclipIcon, Database, FileText, Code, Table, Lightbulb, TrendingUp, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectValue,
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

// Tipos para SQL
type ChatSQLResponse = {
  success: boolean;
  message: string;
  sql_query?: string;
  explanation?: string;
  data?: {
    columns: string[];
    rows: Record<string, any>[];
    row_count: number;
  };
  chart_config?: ChartConfig;
  insights?: string[];
  takeaway?: string;
  error?: string;
};

type ChartConfig = {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  title: string;
  description: string;
  xKey: string;
  yKeys: string[];
  colors: string[];
  legend: boolean;
  responsive: boolean;
  insights?: string[];
  takeaway?: string;
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
  const [queryMode, setQueryMode] = useState<'pdf' | 'sql'>('pdf');
  
  // Debug: Log cuando cambie el queryMode
  useEffect(() => {
    console.log('queryMode cambió a:', queryMode);
  }, [queryMode]);
  const [sqlData, setSqlData] = useState<ChatSQLResponse | null>(null);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [copiedQuery, setCopiedQuery] = useState(false);
  
  // Debug: Log cuando cambie sqlData
  useEffect(() => {
    console.log('sqlData cambió a:', sqlData);
  }, [sqlData]);

  const clearSQLData = () => {
    setSqlData(null);
    setLocalError(undefined);
  };

  const copySQLQuery = async () => {
    if (!sqlData?.sql_query) return;
    
    try {
      await navigator.clipboard.writeText(sqlData.sql_query);
      setCopiedQuery(true);
      setTimeout(() => setCopiedQuery(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const formatCellValue = (value: any, column: string) => {
    if (value === null || value === undefined) return '-';
    
    // Formatear fechas
    if (column.includes('date') && typeof value === 'number') {
      try {
        // Convertir número de Excel a fecha (Excel usa 1900-01-01 como día 1)
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
        return date.toLocaleDateString('es-ES');
      } catch {
        return value.toString();
      }
    }
    
    // Formatear números con separadores de miles
    if (typeof value === 'number' && column.includes('amount')) {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'USD'
      }).format(value);
    }
    
    // Formatear números grandes
    if (typeof value === 'number' && value > 1000) {
      return new Intl.NumberFormat('es-ES').format(value);
    }
    
    return String(value);
  };

  const renderChart = (chartConfig: ChartConfig, data: any[]) => {
    const commonProps = {
      data: data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chartConfig.type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chartConfig.xKey} />
            <YAxis />
            <Tooltip />
            {chartConfig.legend && <Legend />}
            {chartConfig.yKeys.map((key, index) => (
              <Bar 
                key={key} 
                dataKey={key} 
                fill={chartConfig.colors[index % chartConfig.colors.length]} 
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chartConfig.xKey} />
            <YAxis />
            <Tooltip />
            {chartConfig.legend && <Legend />}
            {chartConfig.yKeys.map((key, index) => (
              <Line 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={chartConfig.colors[index % chartConfig.colors.length]} 
                strokeWidth={2}
              />
            ))}
          </LineChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={chartConfig.yKeys[0]}
              nameKey={chartConfig.xKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={chartConfig.colors[index % chartConfig.colors.length]} 
                />
              ))}
            </Pie>
            <Tooltip />
            {chartConfig.legend && <Legend />}
          </PieChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chartConfig.xKey} />
            <YAxis />
            <Tooltip />
            {chartConfig.legend && <Legend />}
            {chartConfig.yKeys.map((key, index) => (
              <Area 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stackId="1" 
                stroke={chartConfig.colors[index % chartConfig.colors.length]} 
                fill={chartConfig.colors[index % chartConfig.colors.length]} 
              />
            ))}
          </AreaChart>
        );

      default:
        return <div>Tipo de gráfico no soportado: {chartConfig.type}</div>;
    }
  };

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

    // Si es modo SQL, usar el endpoint SQL
    if (queryMode === 'sql') {
      await handleSQLQuery(userMessage);
      return;
    }

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

  const handleSQLQuery = async (message: string) => {
    if (!ws) return;
    
    setSqlLoading(true);
    setSqlData(null);
    setLocalError(undefined);

    try {
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión.");

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat/unified`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: `EXCL ${message}`,
          workspace_id: ws
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result: ChatSQLResponse = await response.json();
      
      console.log('Respuesta SQL del backend:', result);
      console.log('Estableciendo sqlData con:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Error en la consulta SQL');
      }

      setSqlData(result);
      console.log('sqlData establecido, queryMode:', queryMode);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error en consulta SQL";
      setLocalError(message);
    } finally {
      setSqlLoading(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHasText(e.target.value.trim().length > 0);
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
  const isFirstTime = messages.length === 0;

  // Estados para los botones del PromptInput
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o");
  const [useMicrophone, setUseMicrophone] = useState<boolean>(false);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [hasText, setHasText] = useState<boolean>(false);

  // Modelos disponibles
  const models = [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "claude-3-opus", name: "Claude 3 Opus" },
    { id: "gemini-pro", name: "Gemini Pro" },
  ];

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Header con SourcesPanel */}
        <div className="flex items-start justify-between mb-3">
          <div className="space-y-1">
            <WorkspaceBreadcrumb
              workspaceName={workspaceName}
              workspaceId={ws}
              isLoading={workspaceLoading}
              currentPage="Chat"
            />
          </div>
          
          {/* SourcesPanel en la parte superior derecha */}
          <div className="flex-shrink-0">
            <SourcesPanel
              wsDocs={wsDocs}
              wsDocsLoading={wsDocsLoading}
              wsDocsError={wsDocsError}
              onRefresh={fetchWorkspaceDocs}
            />
          </div>
        </div>

              {/* Modo de consulta */}
              <div className="mb-3">
                <Tabs value={queryMode} onValueChange={(value) => setQueryMode(value as 'pdf' | 'sql')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pdf" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      PDF/RAG
                    </TabsTrigger>
                    <TabsTrigger value="sql" className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      SQL
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

        {/* Main chat area */}
        <div className="flex-1 min-h-0 flex flex-col">

          {/* Mostrar resultados SQL si estamos en modo SQL */}
          {queryMode === 'sql' && sqlData && (
            <div className="mb-4 space-y-4">
              {/* Header con mensaje */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-blue-900">{sqlData.message}</h3>
                  </div>
                  <button
                    onClick={clearSQLData}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Limpiar
                  </button>
                </div>
                {sqlData.explanation && (
                  <p className="text-sm text-blue-700">{sqlData.explanation}</p>
                )}
              </div>
              
              {/* Consulta SQL */}
              {sqlData.sql_query && (
                <div className="bg-gray-50 border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Consulta SQL Generada
                    </h4>
                    <button
                      onClick={copySQLQuery}
                      className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                    >
                      {copiedQuery ? '✓ Copiado' : '📋 Copiar'}
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-sm overflow-x-auto">
                    <code>{sqlData.sql_query}</code>
                  </pre>
                </div>
              )}

              {/* Resultados de datos */}
              {sqlData.data && sqlData.data.rows.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Table className="h-4 w-4" />
                    Resultados ({sqlData.data.row_count} filas)
                  </h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {sqlData.data.columns.map(col => (
                            <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {col.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sqlData.data.rows.slice(0, 10).map((row, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {sqlData.data!.columns.map(col => (
                              <td key={col} className="px-4 py-3 text-sm text-gray-900">
                                {formatCellValue(row[col], col)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {sqlData.data.row_count > 10 && (
                    <p className="mt-3 text-sm text-gray-500 text-center">
                      Mostrando 10 de {sqlData.data.row_count} filas
                    </p>
                  )}
                </div>
              )}

              {/* Gráfico */}
              {sqlData.chart_config && sqlData.data && sqlData.data.rows.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {sqlData.chart_config.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">{sqlData.chart_config.description}</p>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      {renderChart(sqlData.chart_config, sqlData.data.rows)}
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Insights */}
              {sqlData.insights && sqlData.insights.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2 text-yellow-800">
                    <Lightbulb className="h-4 w-4" />
                    Insights
                  </h4>
                  <ul className="space-y-2">
                    {sqlData.insights.map((insight, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="bg-yellow-200 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full mt-0.5">
                          {index + 1}
                        </span>
                        <span className="text-sm text-yellow-700">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Takeaway */}
              {sqlData.takeaway && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2 text-green-800">
                    <TrendingUp className="h-4 w-4" />
                    Conclusión Principal
                  </h4>
                  <p className="text-sm text-green-700">{sqlData.takeaway}</p>
                </div>
              )}
            </div>
          )}

          {/* Mostrar loading para SQL */}
          {queryMode === 'sql' && sqlLoading && (
            <div className="mb-4 p-4 bg-white border rounded-lg">
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                <span>Ejecutando consulta SQL...</span>
              </div>
            </div>
          )}

          {/* Estado vacío para SQL */}
          {queryMode === 'sql' && !sqlData && !sqlLoading && (
            <div className="mb-4 p-8 bg-white border rounded-lg text-center">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Consulta tu base de datos
              </h3>
              <p className="text-gray-500 mb-4">
                Escribe una pregunta en lenguaje natural para generar consultas SQL automáticamente
              </p>
              <div className="text-sm text-gray-400">
                <p>Ejemplos:</p>
                <ul className="mt-2 space-y-1">
                  <li>• "¿Cuáles son las 5 transacciones con mayor monto?"</li>
                  <li>• "¿Cuántas transacciones hay por canal de pago?"</li>
                  <li>• "¿Cuál es el promedio de monto por transacción?"</li>
                </ul>
              </div>
            </div>
          )}

          {/* Estado inicial - PromptInput centrado */}
          {isFirstTime ? (
            <div className="flex-1 flex items-start justify-center pt-24">
              <div className="w-full max-w-2xl space-y-4">
                <div className="text-center space-y-2 pb-3 pt-2">
                  <h2 className="text-4xl font-light text-gray-900 font-montserrat">Welcome to your knowledge</h2>
                  {/* <p className="text-lg text-gray-600">
                    ¿En qué puedo ayudarte hoy?
                  </p> */}
                </div>
                
                <PromptInput
                  onSubmit={handleSubmit}
                  className="w-full max-w-4xl border border-gray-300 rounded-2xl !divide-y-0 [&>*]:border-b-0"
                  globalDrop
                  multiple
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
                            placeholder={queryMode === 'sql' ? "Escribe tu consulta SQL en lenguaje natural..." : "Escribe tu pregunta..."}
                            disabled={isStreaming || sqlLoading}
                            className="!text-lg pl-4 pt-4"
                            onChange={handleTextChange}
                          />
                  </PromptInputBody>
                  <PromptInputToolbar className="border-t-0">
                    <PromptInputTools>
                      <PromptInputActionMenu>
                        <PromptInputActionMenuTrigger />
                        <PromptInputActionMenuContent>
                          <PromptInputActionAddAttachments />
                        </PromptInputActionMenuContent>
                      </PromptInputActionMenu>

                      <PromptInputButton
                        onClick={() => setUseMicrophone(!useMicrophone)}
                        variant={useMicrophone ? "default" : "ghost"}
                        className={useMicrophone ? "text-blue-600" : "text-gray-500"}
                      >
                        <MicIcon size={16} className={useMicrophone ? "text-blue-600" : "text-gray-500"} />
                        <span className="sr-only">Microphone</span>
                      </PromptInputButton>

                      <PromptInputButton
                        onClick={() => setUseWebSearch(!useWebSearch)}
                        variant={useWebSearch ? "default" : "ghost"}
                        className={useWebSearch ? "text-green-600" : "text-gray-500"}
                      >
                        <GlobeIcon size={16} className={useWebSearch ? "text-green-600" : "text-gray-500"} />
                        <span>Search</span>
                      </PromptInputButton>

                      <PromptInputModelSelect
                        onValueChange={(value) => setSelectedModel(value)}
                        value={selectedModel}
                      >
                        <PromptInputModelSelectTrigger>
                          <PromptInputModelSelectValue />
                        </PromptInputModelSelectTrigger>
                        <PromptInputModelSelectContent>
                          {models.map((model) => (
                            <PromptInputModelSelectItem key={model.id} value={model.id}>
                              {model.name}
                            </PromptInputModelSelectItem>
                          ))}
                        </PromptInputModelSelectContent>
                      </PromptInputModelSelect>
                    </PromptInputTools>
                          <PromptInputSubmit
                            status={isStreaming || sqlLoading ? "streaming" : status}
                            disabled={!canSend || sqlLoading}
                            className={`${hasText ? 'bg-[#008ace] cursor-pointer' : 'bg-gray-300 cursor-not-allowed'} text-white rounded-lg mr-2 mb-2 mt-2`}
                          />
                  </PromptInputToolbar>
                </PromptInput>

                {/* Error */}
                {combinedChatError && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                    {combinedChatError || "Error en el chat"}
                  </div>
                )}
              </div>
            </div>
                ) : (
                  /* Chat Messages - Área con scroll */
                  <div className="flex-1 min-h-0 flex flex-col">
                    {/* Mostrar resultados SQL si estamos en modo SQL */}

                    <Conversation className="flex-1 min-h-0 overflow-y-auto">
                      <ConversationContent className="pb-4">
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
              <div className="flex-shrink-0 mt-4 flex justify-center">
                <div className="w-full max-w-2xl">
                  <PromptInput
                    onSubmit={handleSubmit}
                    className="w-full border border-gray-300 rounded-2xl !divide-y-0 [&>*]:border-b-0"
                    globalDrop
                    multiple
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
                            placeholder={queryMode === 'sql' ? "Escribe tu consulta SQL en lenguaje natural..." : "Escribe tu pregunta..."}
                            disabled={isStreaming || sqlLoading}
                            className="!text-lg pl-4 pt-4"
                            onChange={handleTextChange}
                          />
                    </PromptInputBody>
                    <PromptInputToolbar className="border-t-0">
                      <PromptInputTools>
                        <PromptInputActionMenu>
                          <PromptInputActionMenuTrigger />
                          <PromptInputActionMenuContent>
                            <PromptInputActionAddAttachments />
                          </PromptInputActionMenuContent>
                        </PromptInputActionMenu>

                        <PromptInputButton
                          onClick={() => setUseMicrophone(!useMicrophone)}
                          variant={useMicrophone ? "default" : "ghost"}
                          className={useMicrophone ? "text-blue-600" : "text-gray-500"}
                        >
                          <MicIcon size={16} className={useMicrophone ? "text-blue-600" : "text-gray-500"} />
                          <span className="sr-only">Microphone</span>
                        </PromptInputButton>

                        <PromptInputButton
                          onClick={() => setUseWebSearch(!useWebSearch)}
                          variant={useWebSearch ? "default" : "ghost"}
                          className={useWebSearch ? "text-green-600" : "text-gray-500"}
                        >
                          <GlobeIcon size={16} className={useWebSearch ? "text-green-600" : "text-gray-500"} />
                          <span>Search</span>
                        </PromptInputButton>

                        <PromptInputModelSelect
                          onValueChange={(value) => setSelectedModel(value)}
                          value={selectedModel}
                        >
                          <PromptInputModelSelectTrigger>
                            <PromptInputModelSelectValue />
                          </PromptInputModelSelectTrigger>
                          <PromptInputModelSelectContent>
                            {models.map((model) => (
                              <PromptInputModelSelectItem key={model.id} value={model.id}>
                                {model.name}
                              </PromptInputModelSelectItem>
                            ))}
                          </PromptInputModelSelectContent>
                        </PromptInputModelSelect>
                      </PromptInputTools>
                          <PromptInputSubmit
                            status={isStreaming || sqlLoading ? "streaming" : status}
                            disabled={!canSend || sqlLoading}
                            className={`${hasText ? 'bg-[#008ace] cursor-pointer' : 'bg-gray-300 cursor-not-allowed'} text-white rounded-lg mr-2 mb-2 mt-2`}
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
          )}
            </div>
          </div>
    </div>
  );
}
