"use client";

import { useEffect, useState } from "react";
import { FileUploadZone } from "@/components/documents/file-upload-zone";
import { DocumentTable } from "@/components/documents/document-table";
import { Separator } from "@/components/ui/separator";
import { getDocuments, deleteAllDocuments } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { Document } from "@/lib/types";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    getDocuments().then(setDocuments).catch(console.error);
  }, []);

  // Poll every 2s while any document is still processing
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "processing");
    if (!hasProcessing) return;
    const id = setInterval(async () => {
      const docs = await getDocuments();
      setDocuments(docs);
      if (docs.every((d) => d.status !== "processing")) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [documents]);

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      <h1 className="text-2xl font-bold">Documents</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Upload</h2>
        <FileUploadZone
          onUploaded={(doc) => setDocuments((prev) => [doc, ...prev])}
        />
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Indexed Documents</h2>
          {documents.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!confirm("Delete all documents? This cannot be undone.")) return;
                await deleteAllDocuments();
                setDocuments([]);
              }}
            >
              Delete All
            </Button>
          )}
        </div>
        <DocumentTable
          documents={documents}
          onDeleted={(id) => setDocuments((prev) => prev.filter((d) => d.id !== id))}
        />
      </section>
    </div>
  );
}
