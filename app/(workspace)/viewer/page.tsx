"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function ViewerPage() {
  const search = useSearchParams();
  const docId = search.get("doc_id") || "";
  const page = Number(search.get("page") || "1");
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL;

  // Assumes backend serves a pdf_url like /documents/:id/pdf
  const pdfUrl = `${backendBase}/documents/${encodeURIComponent(docId)}/pdf`;

  useEffect(() => {
    // If using pdf.js in the future, we can control page in the viewer here
  }, [page]);

  return (
    <div className="w-screen h-screen flex flex-col">
      <div className="p-3 border-b">
        <div className="text-sm text-gray-700">Documento: <code>{docId}</code></div>
        <div className="text-sm text-gray-700">Página {page}</div>
      </div>
      <iframe ref={frameRef} src={pdfUrl} className="flex-1 w-full" title="PDF Viewer" />
    </div>
  );
}


