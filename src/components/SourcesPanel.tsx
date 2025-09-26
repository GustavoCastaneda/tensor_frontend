"use client";

import React, { useState } from 'react';
import { Check, ChevronsUpDown, FileText, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type WorkspaceDoc = {
  id: string;
  filename: string;
  status: string;
  pages_count?: number;
  created_at?: string;
};

interface SourcesPanelProps {
  wsDocs: WorkspaceDoc[];
  wsDocsLoading: boolean;
  wsDocsError: string | undefined;
  onRefresh: () => void;
}

export function SourcesPanel({ wsDocs, wsDocsLoading, wsDocsError, onRefresh }: SourcesPanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<WorkspaceDoc | null>(null);

  // Preparar datos para el combobox
  const docOptions = wsDocs.map((doc) => ({
    value: doc.id,
    label: doc.filename,
    doc: doc,
  }));

  const handleSelect = (docId: string) => {
    const doc = wsDocs.find((d) => d.id === docId);
    if (doc) {
      setSelectedDoc(doc);
      setOpen(false);
      // Abrir el documento en una nueva pestaña
      window.open(`/viewer?doc_id=${encodeURIComponent(doc.id)}&page=1`, '_blank');
    }
  };

  return (
    <div className="space-y-2 max-w-xs">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-montserrat font-medium text-gray-700">Sources</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={wsDocsLoading}
                  className="h-7 px-2 text-gray-800 border-0 shadow-none hover:bg-gray-50"
                >
          <RefreshCw className={cn("h-3 w-3", wsDocsLoading && "animate-spin")} />
        </Button>
      </div>

      <div className="space-y-2">
        {/* Combobox para seleccionar documento */}
        <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between h-9 border-gray-400"
                    >
              {selectedDoc ? (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="truncate">{selectedDoc.filename}</span>
                </div>
              ) : (
                <span className="text-muted-foreground font-montserrat text-gray-600">Mis documentos...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar documento..." className="h-9" />
              <CommandList>
                <CommandEmpty>
                  {wsDocsLoading ? "Cargando..." : "No se encontraron documentos."}
                </CommandEmpty>
                {wsDocsError && (
                  <div className="p-2 text-sm text-red-600">
                    Error: {wsDocsError}
                  </div>
                )}
                <CommandGroup>
                  {docOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => handleSelect(option.value)}
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.doc.status} · {option.doc.pages_count ?? 0} pág.
                        </div>
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          selectedDoc?.id === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Información del documento seleccionado */}
        {selectedDoc && (
          <div className="border rounded-lg p-2 bg-blue-50">
            <div className="flex items-center gap-2">
              <FileText className="h-3 w-3 text-blue-600" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-blue-900 truncate" title={selectedDoc.filename}>
                  {selectedDoc.filename}
                </div>
                <div className="text-xs text-blue-700">
                  {selectedDoc.status} · {selectedDoc.pages_count ?? 0} páginas
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {!wsDocsLoading && !wsDocsError && wsDocs.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            <FileText className="h-6 w-6 mx-auto mb-1 opacity-50" />
            <p className="text-xs">No hay documentos disponibles</p>
          </div>
        )}
      </div>
    </div>
  );
}
