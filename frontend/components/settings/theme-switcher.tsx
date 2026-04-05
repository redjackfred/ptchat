"use client";

import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-1.5">
      <Label>Theme</Label>
      <Select value={theme ?? "system"} onValueChange={(v) => v && setTheme(v)}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
