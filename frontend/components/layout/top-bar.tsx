"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Session, Provider } from "@/lib/types";

interface TopBarProps {
  session: Session | null;
  providers: Provider[];
  onProviderChange: (provider: string, model: string) => void;
}

export function TopBar({ session, providers, onProviderChange }: TopBarProps) {
  const currentValue = session ? `${session.llm_provider}:${session.llm_model}` : "";

  return (
    <div className="flex h-12 items-center justify-between border-b px-4 bg-background/95 backdrop-blur">
      <span className="font-medium text-sm truncate max-w-xs">
        {session?.name ?? "Select a session"}
      </span>

      {session && (
        <Select
          value={currentValue}
          onValueChange={(val) => {
            if (!val) return;
            const [provider, ...modelParts] = val.split(":");
            onProviderChange(provider, modelParts.join(":"));
          }}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) =>
              provider.models.map((model) => (
                <SelectItem key={`${provider.name}:${model}`} value={`${provider.name}:${model}`}>
                  <span className="text-xs">
                    {provider.name} / {model}
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
