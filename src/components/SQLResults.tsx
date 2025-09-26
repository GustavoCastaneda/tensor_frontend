"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Database, 
  Table, 
  BarChart3, 
  Code, 
  Lightbulb, 
  TrendingUp,
  Copy,
  Check
} from 'lucide-react';
import { ChatSQLResponse } from '@/types/sql';
import { useState } from 'react';

interface SQLResultsProps {
  data: ChatSQLResponse;
}

export function SQLResults({ data }: SQLResultsProps) {
  const [copiedQuery, setCopiedQuery] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedQuery(true);
      setTimeout(() => setCopiedQuery(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const renderChart = () => {
    if (!data.chart_config || !data.data) return null;

    const { chart_config } = data;
    const chartData = data.data.rows;

    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chart_config.type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart_config.xKey} />
            <YAxis />
            <Tooltip />
            {chart_config.legend && <Legend />}
            {chart_config.yKeys.map((key, index) => (
              <Bar 
                key={key} 
                dataKey={key} 
                fill={chart_config.colors[index % chart_config.colors.length]} 
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart_config.xKey} />
            <YAxis />
            <Tooltip />
            {chart_config.legend && <Legend />}
            {chart_config.yKeys.map((key, index) => (
              <Line 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={chart_config.colors[index % chart_config.colors.length]} 
                strokeWidth={2}
              />
            ))}
          </LineChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chartData}
              dataKey={chart_config.yKeys[0]}
              nameKey={chart_config.xKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={chart_config.colors[index % chart_config.colors.length]} 
                />
              ))}
            </Pie>
            <Tooltip />
            {chart_config.legend && <Legend />}
          </PieChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart_config.xKey} />
            <YAxis />
            <Tooltip />
            {chart_config.legend && <Legend />}
            {chart_config.yKeys.map((key, index) => (
              <Area 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stackId="1" 
                stroke={chart_config.colors[index % chart_config.colors.length]} 
                fill={chart_config.colors[index % chart_config.colors.length]} 
              />
            ))}
          </AreaChart>
        );

      default:
        return <div>Tipo de gráfico no soportado: {chart_config.type}</div>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Mensaje principal */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">{data.message}</h3>
          </div>
        </CardContent>
      </Card>

      {/* Consulta SQL */}
      {data.sql_query && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Consulta SQL
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(data.sql_query!)}
              >
                {copiedQuery ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              <code>{data.sql_query}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Explicación */}
      {data.explanation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Explicación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{data.explanation}</p>
          </CardContent>
        </Card>
      )}

      {/* Resultados con pestañas */}
      {data.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="h-5 w-5" />
              Resultados ({data.data.row_count} filas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="table" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="table">Tabla</TabsTrigger>
                <TabsTrigger value="chart" disabled={!data.chart_config}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Gráfico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="table" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {data.data.columns.map(col => (
                          <th 
                            key={col} 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.data.rows.slice(0, 10).map((row, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {data.data.columns.map(col => (
                            <td 
                              key={col} 
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                            >
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.data.row_count > 10 && (
                    <p className="mt-2 text-sm text-gray-500 text-center">
                      Mostrando 10 de {data.data.row_count} filas
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="chart" className="mt-4">
                {data.chart_config && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-lg font-semibold">{data.chart_config.title}</h4>
                      <p className="text-gray-600">{data.chart_config.description}</p>
                    </div>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        {renderChart()}
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {data.insights && data.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.insights.map((insight, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Badge variant="secondary" className="mt-0.5">
                    {index + 1}
                  </Badge>
                  <span className="text-sm">{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Takeaway */}
      {data.takeaway && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Lightbulb className="h-5 w-5" />
              Conclusión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-700">{data.takeaway}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
