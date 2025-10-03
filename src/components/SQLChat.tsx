"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect } from "react";
import { Database, Code, Table, Lightbulb, TrendingUp, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

// Types
interface ChatSQLResponse {
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

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  title: string;
  description: string;
  xKey: string;
  yKeys: string[];
  colors: string[];
  legend: boolean;
  responsive: boolean;
}

interface SQLChatProps {
  workspaceId: string;
  onError?: (error: string) => void;
}

export function SQLChat({ workspaceId, onError }: SQLChatProps) {
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [sqlData, setSqlData] = useState<ChatSQLResponse | null>(null);

  // Use useChat for SQL queries
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: '/api/chat/unified',
    body: {
      workspace_id: workspaceId
    },
    onFinish: (message) => {
      console.log('SQL Message finished:', message);
      
      // Try to parse the response as SQL data
      try {
        const content = message.content;
        if (typeof content === 'string') {
          // Try to parse as JSON
          const parsed = JSON.parse(content);
          if (parsed.success && parsed.data) {
            setSqlData(parsed);
          }
        }
      } catch (error) {
        console.log('Response is not SQL data, treating as regular message');
      }
    },
    onError: (error) => {
      console.error('SQL Chat error:', error);
      onError?.(error.message);
    }
  });

  // Clear SQL data
  const clearSQLData = () => {
    setSqlData(null);
    setMessages([]);
  };

  // Copy SQL query
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

  // Format cell values
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

  // Render chart
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

  return (
    <div className="space-y-4">
      {/* Mostrar resultados SQL */}
      {sqlData && (
        <div className="space-y-4">
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
      {isLoading && (
        <div className="mb-4 p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span>Ejecutando consulta SQL...</span>
          </div>
        </div>
      )}

      {/* Estado vacío para SQL */}
      {!sqlData && !isLoading && (
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

      {/* Input form para SQL */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Escribe tu consulta SQL en lenguaje natural..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </form>

      {/* Mostrar mensajes de conversación */}
      {messages.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Conversación SQL:</h4>
          {messages.map((message, index) => (
            <div key={index} className={`p-3 rounded-lg ${
              message.role === 'user' 
                ? 'bg-blue-100 text-blue-900 ml-8' 
                : 'bg-gray-100 text-gray-900 mr-8'
            }`}>
              <div className="text-sm font-medium mb-1">
                {message.role === 'user' ? 'Tú' : 'Sistema'}
              </div>
              <div className="text-sm">{message.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
