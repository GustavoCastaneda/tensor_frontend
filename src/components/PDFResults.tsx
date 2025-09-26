"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Lightbulb, 
  ExternalLink, 
  Copy, 
  Check,
  BookOpen,
  Quote
} from 'lucide-react';
import { ChatPDFResponse } from '@/types/sql';
import { useState } from 'react';

interface PDFResultsProps {
  data: ChatPDFResponse;
}

export function PDFResults({ data }: PDFResultsProps) {
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAnswer(true);
      setTimeout(() => setCopiedAnswer(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Respuesta principal */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">{data.message}</h3>
          </div>
        </CardContent>
      </Card>

      {/* Respuesta del documento */}
      {data.answer && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Respuesta
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(data.answer!)}
              >
                {copiedAnswer ? (
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
            <div className="prose max-w-none">
              <p className="text-gray-700 leading-relaxed">{data.answer}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Razonamiento */}
      {data.reasoning && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Lightbulb className="h-5 w-5" />
              Razonamiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <p className="text-blue-700 leading-relaxed">{data.reasoning}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fuentes */}
      {data.sources && data.sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Quote className="h-5 w-5" />
              Fuentes ({data.sources.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.sources.map((source, index) => (
                <div 
                  key={source.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        Página {source.page}
                      </Badge>
                      <span className="text-sm font-medium text-gray-700">
                        {source.filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={source.score > 0.8 ? "default" : source.score > 0.6 ? "secondary" : "outline"}
                      >
                        {Math.round(source.score * 100)}% relevancia
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/viewer?doc_id=${source.id}&page=${source.page}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 bg-gray-100 p-3 rounded border-l-4 border-blue-500">
                    <Quote className="h-4 w-4 inline mr-1" />
                    {source.content}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado vacío si no hay fuentes */}
      {(!data.sources || data.sources.length === 0) && (
        <Card className="border-gray-200">
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron fuentes específicas para esta consulta</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
