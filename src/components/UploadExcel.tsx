"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface PreviewRow {
  [key: string]: any;
}

type ExcelStatus =
  | "idle"
  | "uploading"           // subiendo a Storage
  | "processing"          // procesando Excel
  | "ready"              // listo para consultas
  | "error";

interface UploadExcelProps {
  onDatasetReady?: (datasetId: string) => void;
}

export default function UploadExcel({ onDatasetReady }: UploadExcelProps) {
  const { getToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [datasetId, setDatasetId] = useState<string>("");
  const [status, setStatus] = useState<ExcelStatus>("idle");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // refs para manejar polling y evitar fugas
  const intervalRef = useRef<number | null>(null);
  const triesRef = useRef<number>(0);

  // limpiar interval al desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  const isExcelFile = (file: File) => {
    const excelTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
    ];
    return excelTypes.includes(file.type) || 
           file.name.toLowerCase().endsWith('.xlsx') ||
           file.name.toLowerCase().endsWith('.xls') ||
           file.name.toLowerCase().endsWith('.xlsm');
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    // Validar que sea un archivo Excel
    if (!isExcelFile(file)) {
      setError("Por favor selecciona un archivo Excel (.xlsx, .xls, .xlsm)");
      return;
    }

    setError("");
    setStatus("uploading");
    setPreview([]);
    setUploadProgress(0);

    // Si ya había un polling previo, lo limpio
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    triesRef.current = 0;

    try {
      /* 1️⃣ Obtener JWT */
      const token = await getToken({ template: "Tensor" });
      if (!token) throw new Error("No hay token de sesión");

      /* 2️⃣ Obtener URL de upload */
      console.log("Obteniendo URL de upload para:", file.name);
      const uploadUrlResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/upload-url?filename=${encodeURIComponent(file.name)}`,
        { 
          method: "POST", 
          headers: { Authorization: `Bearer ${token}` } 
        }
      );
      
      console.log("Respuesta de upload-url:", uploadUrlResponse.status, uploadUrlResponse.statusText);
      
      if (!uploadUrlResponse.ok) {
        const errorText = await uploadUrlResponse.text();
        console.error("Error obteniendo URL de upload:", errorText);
        throw new Error(`Error obteniendo URL de upload: ${errorText}`);
      }
      
      const { upload_url, dataset_id, object_key } = await uploadUrlResponse.json();
      console.log("URL de upload obtenida:", upload_url);
      console.log("Dataset ID:", dataset_id);
      console.log("Object key:", object_key);
      setDatasetId(dataset_id);

      /* 3️⃣ Subir archivo Excel a Storage */
      console.log("=== INICIANDO UPLOAD A SUPABASE ===");
      console.log("URL de destino:", upload_url);
      console.log("Archivo:", file.name, "Tamaño:", file.size, "Tipo:", file.type);
      console.log("Headers que se enviarán:", {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "x-upsert": "true"
      });
      
      // Simular progreso de upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      try {
        const uploadResponse = await fetch(upload_url, {
          method: "PUT",
          body: file,
          headers: { 
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "x-upsert": "true"
          },
        });
        
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        console.log("=== RESPUESTA DE SUPABASE ===");
        console.log("Status:", uploadResponse.status);
        console.log("Status Text:", uploadResponse.statusText);
        console.log("Headers de respuesta:", Object.fromEntries(uploadResponse.headers.entries()));
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error("❌ ERROR EN UPLOAD:", errorText);
          throw new Error(`Error subiendo el archivo Excel: ${uploadResponse.status} - ${errorText}`);
        }
        
        console.log("✅ Archivo subido exitosamente a Supabase Storage");
        console.log("=== UPLOAD COMPLETADO ===");
        
        // Notificar subida completada para procesamiento inmediato
        console.log("=== NOTIFICANDO UPLOAD COMPLETADO ===");
        try {
          const completeResponse = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${dataset_id}/upload-complete`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          
          console.log("Notificación upload-complete:", completeResponse.status, completeResponse.statusText);
          
          if (completeResponse.ok) {
            const result = await completeResponse.json();
            console.log("✅ Backend procesó inmediatamente el archivo");
            console.log("Estado:", result.status);
            console.log("Filas:", result.rows_count);
            
            // El dataset ya está procesado inmediatamente
            if (result.status === "ready_for_embeddings" || result.status === "ready_for_chat") {
              setStatus("ready");
            } else if (result.status === "error") {
              setStatus("error");
            } else {
              setStatus(result.status as ExcelStatus);
            }
            
            // Si hay filas, cargar preview inmediatamente
            if (result.rows_count > 0) {
              console.log("=== CARGANDO PREVIEW INMEDIATO ===");
              try {
                const previewResponse = await fetch(
                  `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${dataset_id}/preview`,
                  { 
                    headers: { Authorization: `Bearer ${token}` }, 
                    cache: "no-store" 
                  }
                );
                
                if (previewResponse.ok) {
                  const { preview: previewData } = await previewResponse.json();
                  console.log("Preview data recibida:", previewData?.length || 0, "filas");
                  setPreview(previewData || []);
                } else {
                  console.log("⚠️ Error cargando preview:", previewResponse.status);
                }
              } catch (previewError) {
                console.error("❌ Error cargando preview:", previewError);
              }
            }
            
            // Llamar callback si está listo
            if (result.status === "ready_for_chat") {
              onDatasetReady?.(dataset_id);
            }
          } else {
            const errorText = await completeResponse.text();
            console.log("⚠️ Error notificando backend:", errorText);
            setStatus("error");
            setError(`Error procesando archivo: ${errorText}`);
          }
        } catch (notifyError) {
          console.error("❌ Error notificando backend:", notifyError);
          setStatus("error");
          setError(`Error notificando backend: ${notifyError.message}`);
        }
        
      } catch (uploadError) {
        clearInterval(progressInterval);
        console.error("❌ ERROR EN FETCH:", uploadError);
        throw uploadError;
      }
      
      setStatus("processing");
      setUploadProgress(100);
    } catch (err: any) {
      setStatus("error");
      setError(err?.message ?? "Error subiendo el archivo Excel");
    }
  }

  const resetUpload = () => {
    setFile(null);
    setDatasetId("");
    setStatus("idle");
    setPreview([]);
    setError("");
    setUploadProgress(0);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const checkStatus = async () => {
    if (!datasetId) return;
    
    try {
      const token = await getToken({ template: "Tensor" });
      if (!token) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${datasetId}/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log("Status check:", data);
        setError(`Status actual: ${data.status}`);
      } else {
        const errorText = await response.text();
        setError(`Error verificando status: ${errorText}`);
      }
    } catch (err: any) {
      setError(`Error verificando status: ${err.message}`);
    }
  };

  const verifyUpload = async () => {
    if (!datasetId) return;
    
    try {
      const token = await getToken({ template: "Tensor" });
      if (!token) return;

      // Verificar si el archivo existe en el backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${datasetId}/info`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log("Dataset info:", data);
        setError(`✅ Archivo encontrado en backend. Info: ${JSON.stringify(data)}`);
      } else {
        const errorText = await response.text();
        setError(`❌ Archivo NO encontrado en backend: ${errorText}`);
      }
    } catch (err: any) {
      setError(`Error verificando upload: ${err.message}`);
    }
  };

  const retryUpload = async () => {
    if (!file || !datasetId) return;
    
    try {
      const token = await getToken({ template: "Tensor" });
      if (!token) return;

      // Obtener nueva URL de upload
      const uploadUrlResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/upload-url?filename=${encodeURIComponent(file.name)}`,
        { 
          method: "POST", 
          headers: { Authorization: `Bearer ${token}` } 
        }
      );
      
      if (!uploadUrlResponse.ok) {
        throw new Error("Error obteniendo nueva URL de upload");
      }
      
      const { upload_url } = await uploadUrlResponse.json();
      
      // Intentar upload con diferentes Content-Types
      const contentTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
        file.type || "application/vnd.ms-excel"
      ];
      
      for (const contentType of contentTypes) {
        try {
          console.log(`Intentando upload con Content-Type: ${contentType}`);
          const response = await fetch(upload_url, {
            method: "PUT",
            body: file,
            headers: { 
              "Content-Type": contentType,
              "x-upsert": "true"
            },
          });
          
          if (response.ok) {
            setError(`✅ Upload exitoso con Content-Type: ${contentType}`);
            return;
          } else {
            console.log(`❌ Falló con ${contentType}: ${response.status}`);
          }
        } catch (err) {
          console.log(`❌ Error con ${contentType}:`, err);
        }
      }
      
      setError("❌ Todos los intentos de upload fallaron");
    } catch (err: any) {
      setError(`Error en retry upload: ${err.message}`);
    }
  };

  const checkSupabaseStorage = async () => {
    if (!datasetId) return;
    
    try {
      const token = await getToken({ template: "Tensor" });
      if (!token) return;

      // Obtener la URL de upload actual
      const uploadUrlResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/upload-url?filename=${encodeURIComponent(file?.name || 'test.xlsx')}`,
        { 
          method: "POST", 
          headers: { Authorization: `Bearer ${token}` } 
        }
      );
      
      if (!uploadUrlResponse.ok) {
        setError("❌ Error obteniendo URL para verificación");
        return;
      }
      
      const { upload_url } = await uploadUrlResponse.json();
      
      // Verificar si el archivo existe en Supabase Storage
      console.log("Verificando archivo en Supabase Storage:", upload_url);
      const verifyResponse = await fetch(upload_url, { method: "HEAD" });
      
      console.log("Respuesta de verificación:", verifyResponse.status, verifyResponse.statusText);
      
      if (verifyResponse.ok) {
        const contentLength = verifyResponse.headers.get('content-length');
        const lastModified = verifyResponse.headers.get('last-modified');
        setError(`✅ Archivo encontrado en Supabase Storage. Tamaño: ${contentLength} bytes, Modificado: ${lastModified}`);
      } else {
        setError(`❌ Archivo NO encontrado en Supabase Storage. Status: ${verifyResponse.status}`);
      }
    } catch (err: any) {
      setError(`Error verificando Supabase Storage: ${err.message}`);
    }
  };

  const getDatasetInfo = async () => {
    if (!datasetId) return;
    
    try {
      const token = await getToken({ template: "Tensor" });
      if (!token) return;

      console.log("Obteniendo información detallada del dataset...");
      
      // Obtener información del dataset
      const infoResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${datasetId}/info`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log("Info response:", infoResponse.status, infoResponse.statusText);
      
      if (infoResponse.ok) {
        const infoData = await infoResponse.json();
        console.log("Dataset info:", infoData);
        setError(`✅ Info del dataset: ${JSON.stringify(infoData, null, 2)}`);
      } else {
        const errorText = await infoResponse.text();
        console.log("Error info:", errorText);
        setError(`❌ Error obteniendo info: ${errorText}`);
      }
      
      // Obtener logs del dataset si están disponibles
      const logsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${datasetId}/logs`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        console.log("Dataset logs:", logsData);
        setError(prev => prev + `\n\n📋 Logs: ${JSON.stringify(logsData, null, 2)}`);
      }
      
    } catch (err: any) {
      setError(`Error obteniendo info del dataset: ${err.message}`);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "uploading":
      case "processing":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case "ready":
      case "ready_for_embeddings":
      case "ready_for_chat":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <FileSpreadsheet className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "uploading":
        return `Subiendo archivo... ${uploadProgress}%`;
      case "processing":
        return "Procesando Excel...";
      case "ready":
        return "¡Listo para consultas!";
      case "ready_for_embeddings":
        return "¡Listo para consultas!";
      case "ready_for_chat":
        return "¡Listo para consultas!";
      case "error":
        return "Error en el procesamiento";
      default:
        return "Selecciona un archivo Excel";
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {getStatusIcon()}
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Haz clic para subir</span> o arrastra tu archivo Excel
                </p>
                <p className="text-xs text-gray-500">XLSX, XLS, XLSM (MAX. 10MB)</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.xlsm"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0] ?? null;
                  setFile(selectedFile);
                  if (selectedFile && !isExcelFile(selectedFile)) {
                    setError("Por favor selecciona un archivo Excel válido");
                  } else {
                    setError("");
                  }
                }}
                disabled={status === "uploading" || status === "processing"}
              />
            </label>
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetUpload}
                className="text-gray-400 hover:text-gray-600"
                disabled={status === "uploading" || status === "processing"}
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={!file || status === "uploading" || status === "processing" || !isExcelFile(file)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4 mr-2" />
              {status === "uploading" ? "Subiendo..." : status === "processing" ? "Procesando..." : "Subir Excel"}
            </button>
          </div>
        </form>
      </div>

      {/* Status and Progress */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="text-sm font-medium text-gray-700">{getStatusText()}</span>
        </div>

        {status === "uploading" && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

                {datasetId && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Dataset ID:</span> {datasetId}
                      </p>
                      <div className="flex space-x-2 flex-wrap">
                        <button
                          onClick={checkStatus}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          Verificar Status
                        </button>
                        <button
                          onClick={verifyUpload}
                          className="text-xs text-green-600 hover:text-green-800 underline"
                        >
                          Verificar Upload
                        </button>
                        <button
                          onClick={checkSupabaseStorage}
                          className="text-xs text-purple-600 hover:text-purple-800 underline"
                        >
                          Verificar Supabase
                        </button>
                        <button
                          onClick={getDatasetInfo}
                          className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                        >
                          Info Detallada
                        </button>
                        <button
                          onClick={retryUpload}
                          className="text-xs text-orange-600 hover:text-orange-800 underline"
                        >
                          Retry Upload
                        </button>
                        <button
                          onClick={async () => {
                            if (!datasetId) return;
                            try {
                              const token = await getToken({ template: "Tensor" });
                              if (!token) return;
                              const response = await fetch(
                                `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/${datasetId}/error`,
                                { headers: { Authorization: `Bearer ${token}` } }
                              );
                              if (response.ok) {
                                const errorData = await response.json();
                                console.log("Error details:", errorData);
                                setError(`Error details: ${JSON.stringify(errorData, null, 2)}`);
                              }
                            } catch (err: any) {
                              setError(`Error obteniendo detalles: ${err.message}`);
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-800 underline"
                        >
                          Ver Error
                        </button>
                      </div>
                    </div>
                  </div>
                )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <div className="flex-1">
                  <p className="text-sm text-red-700">{error}</p>
                  {error.includes("El dataset no pudo ser procesado correctamente") && (
                    <div className="mt-2 text-xs text-red-600">
                      <p className="font-medium">Posibles causas:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Archivo Excel corrupto o dañado</li>
                        <li>Formato no soportado (solo .xlsx, .xls, .xlsm)</li>
                        <li>Archivo protegido con contraseña</li>
                        <li>Hojas de cálculo vacías o sin datos</li>
                        <li>Archivo demasiado grande o complejo</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={resetUpload}
                className="text-sm text-red-600 hover:text-red-800 underline ml-2"
              >
                Reintentar
              </button>
            </div>
            {datasetId && (
              <div className="mt-2 text-xs text-red-600">
                Dataset ID: {datasetId}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Table */}
      {preview.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Vista previa de datos</h3>
          <div className="overflow-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(preview[0]).map((col) => (
                    <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {preview.slice(0, 10).map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {String(val ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 10 && (
            <p className="text-sm text-gray-500 text-center">
              Mostrando las primeras 10 filas de {preview.length} filas totales
            </p>
          )}
        </div>
      )}

      {status === "ready" && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <p className="text-sm font-medium text-green-800">
              ¡Excel procesado exitosamente! Ya puedes hacer consultas sobre los datos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
