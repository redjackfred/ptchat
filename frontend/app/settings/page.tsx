"use client";

import { useEffect, useState } from "react";
import { ApiKeyField } from "@/components/settings/api-key-field";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getProviders, getSettings, updateSettings } from "@/lib/api";
import type { Provider, AppSettings } from "@/lib/types";

export default function SettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ollamaInput, setOllamaInput] = useState("");

  const load = async () => {
    const [p, s] = await Promise.all([getProviders(), getSettings()]);
    setProviders(p);
    setSettings(s);
    setOllamaInput(s.ollama_endpoint);
  };

  useEffect(() => { load(); }, []);

  const saveOllama = async () => {
    await updateSettings({ ollama_endpoint: ollamaInput });
    await load();
  };

  const apiKeyProviders = providers.filter((p) => p.name !== "ollama");

  return (
    <div className="max-w-xl mx-auto py-10 px-4 space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <ThemeSwitcher />
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <p className="text-sm text-muted-foreground">
          Keys are stored in your system keychain, never in the database.
        </p>
        {apiKeyProviders.map((p) => (
          <ApiKeyField
            key={p.name}
            provider={p.name}
            hasKey={p.has_key}
            onSaved={load}
          />
        ))}
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Ollama</h2>
        <div className="space-y-1.5">
          <Label>Endpoint</Label>
          <div className="flex gap-2">
            <Input
              value={ollamaInput}
              onChange={(e) => setOllamaInput(e.target.value)}
              placeholder="http://localhost:11434"
            />
            <Button onClick={saveOllama}>Save</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
