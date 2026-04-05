"use client";

import { useState } from "react";
import { FolderOpen, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateSettings } from "@/lib/api";

interface FolderMonitorProps {
  folders: string[];
  onChanged: () => void;
}

export function FolderMonitor({ folders, onChanged }: FolderMonitorProps) {
  const [input, setInput] = useState("");

  const add = async () => {
    if (!input.trim()) return;
    await updateSettings({ watched_folders: [...folders, input.trim()] });
    setInput("");
    onChanged();
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
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="/path/to/folder"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button size="sm" onClick={add} disabled={!input.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
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
