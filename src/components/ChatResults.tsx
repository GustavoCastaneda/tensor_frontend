import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { ChatResp } from '../hooks/useDashboardChat';

interface ChatResultsProps {
  resp: ChatResp | null;
  onRetryWithColumns: (columns: string[]) => void;
}

export function ChatResults({ resp, onRetryWithColumns }: ChatResultsProps) {
  const [chartType, setChartType] = useState<"line" | "bar">("line");

  // Helper functions
  const isNumeric = (v: any) => {
    if (v == null) return false;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n);
  };

  const looksLikeISODate = (v: any) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);

  // Chart data processing
  const { chartData, xKey, yLabel } = useMemo(() => {
    if (!resp?.table?.rows?.length) {
      return {
        chartData: [] as { x: any; value: number }[],
        xKey: "x",
        yLabel: "Valor",
      };
    }

    const rows = resp.table.rows;
    const suggest = resp.chart_suggestion;

    // 1) Determina candidato a X y a Y
    let candX = suggest?.x;
    let candY = suggest?.y?.[0];

    // Si la sugerencia viene cruzada, corrige:
    const sample = rows[0] ?? {};
    const xLooksNumeric = isNumeric(sample[candX as string]);
    const yLooksNumeric = isNumeric(sample[candY as string]);

    if (!candX || (!looksLikeISODate(sample[candX]) && xLooksNumeric && !yLooksNumeric)) {
      // busca una fecha o string para X
      candX =
        resp.table.columns.find(
          (c) => looksLikeISODate(sample[c]) || typeof sample[c] === "string"
        ) ?? resp.table.columns[0];
    }
    if (!candY || !isNumeric(sample[candY])) {
      // busca una numérica para Y
      candY =
        resp.table.columns.find((c) => isNumeric(sample[c])) ??
        resp.table.columns.find((c) => c !== candX) ??
        resp.table.columns[0];
    }

    const built = rows.map((r) => ({
      x: r[candX!],
      value: isNumeric(r[candY!])
        ? Number(String(r[candY!]).replace(/,/g, ""))
        : 0,
    }));

    return {
      chartData: built,
      xKey: "x",
      yLabel: candY || "Valor",
    };
  }, [resp]);

  const formatXTick = (v: any) =>
    looksLikeISODate(v) ? String(v).slice(0, 7) : String(v);

  if (!resp) return null;

  return (
    <div className="space-y-6">
      {/* Disambiguation */}
      {resp.needs_disambiguation && resp.candidates?.length ? (
        <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
          <div className="mb-3 font-medium text-blue-900">¿A qué columna(s) te refieres?</div>
          <div className="flex flex-wrap gap-2">
            {resp.candidates.map((c) => (
              <button
                key={c}
                className="px-3 py-1.5 border border-blue-300 rounded-md hover:bg-blue-100 text-blue-800 transition-colors"
                onClick={() => onRetryWithColumns([c])}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Answer */}
      {resp.answer && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Explicación:</h3>
          <p className="text-gray-700">{resp.answer}</p>
        </div>
      )}

      {/* SQL */}
      {resp.sql && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">SQL generado:</h3>
          <pre className="whitespace-pre-wrap break-words rounded bg-white p-3 text-sm border overflow-x-auto">
            {resp.sql}
          </pre>
        </div>
      )}

      {/* Table */}
      {resp.table && resp.table.rows.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Resultado:</h3>
          <div className="overflow-auto border rounded-lg">
            <table className="min-w-[700px] w-full border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  {resp.table.columns.map((c) => (
                    <th key={c} className="text-left p-3 border-b font-medium text-gray-700">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resp.table.rows.map((row, i) => (
                  <tr key={i} className="odd:bg-white even:bg-gray-50">
                    {resp.table!.columns.map((c) => (
                      <td key={c} className="p-3 border-b align-top text-gray-700">
                        {String(row[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Gráfica: {yLabel}</h3>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Tipo de gráfica:</label>
                  <select
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value as "line" | "bar")}
                    className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="line">Línea</option>
                    <option value="bar">Barras</option>
                  </select>
                </div>
              </div>

              <div className="h-80 w-full border rounded-lg p-4 bg-white shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "line" ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey={xKey}
                        tickFormatter={formatXTick}
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={{ stroke: "#e5e7eb" }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={{ stroke: "#e5e7eb" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                          color: "#374151",
                        }}
                        formatter={(value: any) => [value, yLabel]}
                        labelFormatter={(label: any) => formatXTick(label)}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: "#3b82f6" }}
                      />
                    </LineChart>
                  ) : (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey={xKey}
                        tickFormatter={formatXTick}
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={{ stroke: "#e5e7eb" }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={{ stroke: "#e5e7eb" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                          color: "#374151",
                        }}
                        formatter={(value: any) => [value, yLabel]}
                        labelFormatter={(label: any) => formatXTick(label)}
                      />
                      <Legend />
                      <Bar
                        dataKey="value"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Retrieval Debug */}
      {resp.retrieval && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-900 mb-2">Retrieval (debug):</h3>
          <p className="text-yellow-800 text-sm">
            {resp.retrieval
              .map((r) => `${r.original_name}(${r.score.toFixed(3)})`)
              .join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
