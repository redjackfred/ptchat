"use client";

import { useState } from "react";
import { FolderOpen, FolderPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateSettings, pickFolder } from "@/lib/api";

interface FolderMonitorProps {
  folders: string[];
  onChanged: () => void;
}

export function FolderMonitor({ folders, onChanged }: FolderMonitorProps) {
  const [picking, setPicking] = useState(false);

  const browse = async () => {
    setPicking(true);
    try {
      const { path } = await pickFolder();
      if (path && !folders.includes(path)) {
        await updateSettings({ watched_folders: [...folders, path] });
        onChanged();
      }
    } finally {
      setPicking(false);
    }
  };

  const remove = async (folder: string) => {
    await updateSettings({ watched_folders: folders.filter((f) => f !== folder) });
    onChanged();
  };

  return (
    <div className="space-y-3">
      <Label>Watched Folders</Label>
      <p className="text-xs text-muted-foreground">
        Files added to these folders are automatically indexed.
      </p>
      <Button size="sm" variant="outline" onClick={browse} disabled={picking} className="gap-2">
        <FolderPlus className="h-4 w-4" />
        {picking ? "Opening…" : "Add Folder…"}
      </Button>
      {folders.map((folder) => (
        <div key={folder} className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm">
          <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="flex-1 truncate font-mono text-xs">{folder}</span>
          <button onClick={() => remove(folder)} className="text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
