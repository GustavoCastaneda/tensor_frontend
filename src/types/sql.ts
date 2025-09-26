// Tipos para el sistema SQL
export interface ChatSQLRequest {
  message: string;
  workspace_id: string;
  dataset_id?: string;
  document_id?: string;
}

export interface ChatSQLResponse {
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
}

export interface ChartConfig {
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
}

// Tipos para el sistema PDF/RAG
export interface ChatPDFRequest {
  message: string;
  workspace_id: string;
  document_id?: string;
}

export interface ChatPDFResponse {
  success: boolean;
  message: string;
  answer?: string;
  sources?: Array<{
    id: string;
    filename: string;
    page: number;
    content: string;
    score: number;
  }>;
  reasoning?: string;
  error?: string;
}

// Tipos unificados para la interfaz
export type QueryType = 'sql' | 'pdf';

export interface UnifiedQueryRequest {
  message: string;
  workspace_id: string;
  query_type: QueryType;
  dataset_id?: string;
  document_id?: string;
}

export type UnifiedQueryResponse = ChatSQLResponse | ChatPDFResponse;
