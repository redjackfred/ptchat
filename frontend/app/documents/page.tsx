"use client";

import { useEffect, useState } from "react";
import { FileUploadZone } from "@/components/documents/file-upload-zone";
import { DocumentTable } from "@/components/documents/document-table";
import { FolderMonitor } from "@/components/documents/folder-monitor";
import { Separator } from "@/components/ui/separator";
import { getDocuments, getSettings } from "@/lib/api";
import type { Document, AppSettings } from "@/lib/types";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const loadAll = async () => {
    const [docs, s] = await Promise.all([getDocuments(), getSettings()]);
    setDocuments(docs);
    setSettings(s);
  };

  useEffect(() => { loadAll(); }, []);

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
        <h2 className="text-lg font-semibold">Indexed Documents</h2>
        <DocumentTable
          documents={documents}
          onDeleted={(id) => setDocuments((prev) => prev.filter((d) => d.id !== id))}
        />
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Folder Monitoring</h2>
        {settings && (
          <FolderMonitor
            folders={settings.watched_folders}
            onChanged={loadAll}
          />
        )}
      </section>
    </div>
  );
}
