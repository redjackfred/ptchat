"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteDocument } from "@/lib/api";
import type { Document } from "@/lib/types";

interface DocumentTableProps {
  documents: Document[];
  onDeleted: (id: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  processing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ready: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentTable({ documents, onDeleted }: DocumentTableProps) {
  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    onDeleted(id);
  };

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No documents indexed yet.
      </p>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Name</th>
            <th className="text-left px-4 py-2 font-medium">Type</th>
            <th className="text-left px-4 py-2 font-medium">Size</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
            <th className="text-left px-4 py-2 font-medium">Source</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="border-t hover:bg-muted/30">
              <td className="px-4 py-2 max-w-xs truncate">{doc.name}</td>
              <td className="px-4 py-2 text-muted-foreground uppercase text-xs">{doc.file_type}</td>
              <td className="px-4 py-2 text-muted-foreground">{formatBytes(doc.size_bytes)}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[doc.status] ?? STATUS_STYLES.failed}`}>
                  {doc.status}
                </span>
              </td>
              <td className="px-4 py-2 capitalize text-muted-foreground">{doc.source}</td>
              <td className="px-4 py-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDelete(doc.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
