"use client";

import { useState } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setApiKey, deleteApiKey } from "@/lib/api";

interface ApiKeyFieldProps {
  provider: string;
  hasKey: boolean;
  onSaved: () => void;
}

export function ApiKeyField({ provider, hasKey, onSaved }: ApiKeyFieldProps) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await setApiKey(provider, value.trim());
      setValue("");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await deleteApiKey(provider);
    onSaved();
  };

  return (
    <div className="space-y-1.5">
      <Label className="capitalize">{provider}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? "text" : "password"}
            placeholder={hasKey ? "••••••••••••••• (saved)" : "Enter API key…"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="pr-9"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button size="sm" onClick={save} disabled={!value.trim() || saving}>
          <Check className="h-4 w-4" />
        </Button>
        {hasKey && (
          <Button size="sm" variant="ghost" onClick={remove} title="Remove key">
            <X className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}
