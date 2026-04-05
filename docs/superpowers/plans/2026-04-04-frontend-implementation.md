# PTChat Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a ChatGPT-like Next.js frontend with shadcn/ui + Aceternity UI, supporting multi-LLM chat with SSE streaming, document management, and dark/light theme switching.

**Architecture:** Next.js App Router — three pages (chat, documents, settings). Shared sidebar for navigation and session management. A typed API client in `lib/api.ts` is the single boundary to the FastAPI backend at `http://localhost:8000`. The SSE streaming chat is handled by a custom hook `use-chat-stream.ts`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Aceternity UI (Framer Motion), next-themes, react-markdown, rehype-highlight, Vitest + @testing-library/react

---

## Backend API Contract

The frontend communicates with `http://localhost:8000`. Key endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/settings` | Get app settings |
| PATCH | `/settings` | Update theme/ollama_endpoint/watched_folders |
| GET | `/settings/providers` | List LLM providers + models |
| PUT | `/settings/api-keys/{provider}` | Save API key |
| DELETE | `/settings/api-keys/{provider}` | Remove API key |
| GET | `/documents` | List documents |
| POST | `/documents/upload` | Upload file (multipart/form-data) |
| DELETE | `/documents/{id}` | Delete document |
| GET | `/sessions` | List chat sessions |
| POST | `/sessions` | Create session `{name, llm_provider, llm_model}` |
| PATCH | `/sessions/{id}` | Rename `{name}` |
| DELETE | `/sessions/{id}` | Delete session |
| GET | `/sessions/{id}/messages` | Message history |
| POST | `/sessions/{id}/chat` | Send message, SSE stream `{content}` |

SSE format:
```
data: {"token": "Hello"}
data: {"token": " world"}
data: [DONE]
```

---

## File Map

```
frontend/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── vitest.setup.ts
├── app/
│   ├── globals.css
│   ├── layout.tsx                    # Root layout + ThemeProvider
│   ├── page.tsx                      # Chat page (main)
│   ├── documents/
│   │   └── page.tsx                  # Document management
│   └── settings/
│       └── page.tsx                  # Settings
├── components/
│   ├── layout/
│   │   ├── app-sidebar.tsx           # Sidebar with session list + nav
│   │   └── top-bar.tsx               # Session name + LLM selector
│   ├── chat/
│   │   ├── message-list.tsx          # Scrollable message history
│   │   ├── message-bubble.tsx        # Single message with Markdown
│   │   ├── chat-input.tsx            # Textarea + send button
│   │   └── empty-state.tsx           # Aceternity Spotlight background
│   ├── documents/
│   │   ├── file-upload-zone.tsx      # Aceternity FileUpload component
│   │   ├── document-table.tsx        # Document list with status badges
│   │   └── folder-monitor.tsx        # Folder path + toggle
│   ├── settings/
│   │   ├── api-key-field.tsx          # Masked key input per provider
│   │   └── theme-switcher.tsx         # Dark / Light / System
│   └── ui/                            # shadcn/ui generated components
├── hooks/
│   └── use-chat-stream.ts             # SSE streaming hook
├── lib/
│   ├── types.ts                       # Shared TypeScript types
│   └── api.ts                         # Typed fetch functions
└── __tests__/
    ├── lib/
    │   └── api.test.ts
    └── components/
        ├── message-bubble.test.tsx
        └── chat-input.test.tsx
```

---

## Task 1: Project Setup

**Files:**
- Create: `frontend/` (Next.js project)
- Create: `frontend/vitest.config.ts`
- Create: `frontend/vitest.setup.ts`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /Users/peiwen/Projects/ptchat/.worktrees/backend
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-eslint
```

When prompted, accept all defaults.

- [ ] **Step 2: Install shadcn/ui**

```bash
cd frontend
npx shadcn@latest init
```

Choose: Default style, Zinc base color, yes to CSS variables.

Then add the components we need:

```bash
npx shadcn@latest add button input textarea select dropdown-menu sidebar separator badge scroll-area dialog switch label toast
```

- [ ] **Step 3: Install remaining dependencies**

```bash
npm install next-themes framer-motion react-markdown rehype-highlight highlight.js clsx lucide-react
npm install --save-dev vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 4: Create `frontend/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 5: Create `frontend/vitest.setup.ts`**

```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 6: Add test script to `frontend/package.json`**

In the `"scripts"` section, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Verify setup**

```bash
cd frontend
npm run build 2>&1 | tail -5
```

Expected: build succeeds (Next.js default page)

- [ ] **Step 8: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: Next.js frontend scaffold with shadcn/ui and Vitest"
git push origin feature/backend
```

---

## Task 2: Types + API Client

**Files:**
- Create: `frontend/lib/types.ts`
- Create: `frontend/lib/api.ts`
- Create: `frontend/__tests__/lib/api.test.ts`

- [ ] **Step 1: Create `frontend/lib/types.ts`**

```typescript
export interface Session {
  id: string;
  name: string;
  llm_provider: string;
  llm_model: string;
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface Document {
  id: string;
  name: string;
  file_type: string;
  size_bytes: number | null;
  status: "processing" | "ready" | "failed";
  source: "upload" | "folder";
  file_path: string | null;
  indexed_at: string | null;
  created_at: string;
}

export interface Provider {
  name: string;
  models: string[];
  supports_vision: boolean;
  has_key: boolean;
}

export interface AppSettings {
  theme: "system" | "dark" | "light";
  ollama_endpoint: string;
  watched_folders: string[];
}
```

- [ ] **Step 2: Write failing tests**

Create `frontend/__tests__/lib/api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const BASE = "http://localhost:8000";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("api.getSessions", () => {
  it("calls GET /sessions and returns JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "abc", name: "Test", llm_provider: "openai", llm_model: "gpt-4o", created_at: "" }],
    });

    const { getSessions } = await import("@/lib/api");
    const result = await getSessions();

    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/sessions`);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test");
  });
});

describe("api.createSession", () => {
  it("calls POST /sessions with body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "xyz", name: "New", llm_provider: "ollama", llm_model: "llama3", created_at: "" }),
    });

    const { createSession } = await import("@/lib/api");
    const result = await createSession({ name: "New", llm_provider: "ollama", llm_model: "llama3" });

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/sessions`,
      expect.objectContaining({ method: "POST" })
    );
    expect(result.id).toBe("xyz");
  });
});

describe("api.getProviders", () => {
  it("calls GET /settings/providers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ name: "ollama", models: [], supports_vision: false, has_key: true }],
    });

    const { getProviders } = await import("@/lib/api");
    const result = await getProviders();
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/settings/providers`);
    expect(result[0].name).toBe("ollama");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
cd frontend && npm test 2>&1 | tail -10
```

Expected: module not found error for `@/lib/api`

- [ ] **Step 4: Create `frontend/lib/api.ts`**

```typescript
import type { Session, Message, Document, Provider, AppSettings } from "./types";

const BASE = "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// Sessions
export const getSessions = () => request<Session[]>("/sessions");

export const createSession = (body: Pick<Session, "name" | "llm_provider" | "llm_model">) =>
  request<Session>("/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const renameSession = (id: string, name: string) =>
  request<Session>(`/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const deleteSession = (id: string) =>
  request<{ ok: boolean }>(`/sessions/${id}`, { method: "DELETE" });

export const getMessages = (sessionId: string) =>
  request<Message[]>(`/sessions/${sessionId}/messages`);

// Documents
export const getDocuments = () => request<Document[]>("/documents");

export const uploadDocument = async (file: File): Promise<Document> => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/documents/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
};

export const deleteDocument = (id: string) =>
  request<{ ok: boolean }>(`/documents/${id}`, { method: "DELETE" });

// Settings
export const getSettings = () => request<AppSettings>("/settings");

export const updateSettings = (patch: Partial<AppSettings>) =>
  request<AppSettings>("/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

export const getProviders = () => request<Provider[]>("/settings/providers");

export const setApiKey = (provider: string, key: string) =>
  request<{ ok: boolean }>(`/settings/api-keys/${provider}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });

export const deleteApiKey = (provider: string) =>
  request<{ ok: boolean }>(`/settings/api-keys/${provider}`, { method: "DELETE" });
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd frontend && npm test
```

Expected: 3 tests passed

- [ ] **Step 6: Commit + push**

```bash
cd ..
git add frontend/lib/ frontend/__tests__/
git commit -m "feat: types and typed API client with tests"
git push origin feature/backend
```

---

## Task 3: Root Layout + ThemeProvider

**Files:**
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/globals.css`
- Create: `frontend/components/layout/app-sidebar.tsx`
- Create: `frontend/components/layout/top-bar.tsx`

- [ ] **Step 1: Update `frontend/app/globals.css`**

Keep the existing Tailwind directives, then add after them:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
    --sidebar-background: 0 0% 98%;
    --sidebar-foreground: 240 5.3% 26.1%;
    --sidebar-primary: 240 5.9% 10%;
    --sidebar-primary-foreground: 0 0% 98%;
    --sidebar-accent: 240 4.8% 95.9%;
    --sidebar-accent-foreground: 240 5.9% 10%;
    --sidebar-border: 220 13% 91%;
    --sidebar-ring: 217.2 91.2% 59.8%;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
    --sidebar-background: 240 5.9% 10%;
    --sidebar-foreground: 240 4.8% 95.9%;
    --sidebar-primary: 224.3 76.3% 48%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 240 3.7% 15.9%;
    --sidebar-accent-foreground: 240 4.8% 95.9%;
    --sidebar-border: 240 3.7% 15.9%;
    --sidebar-ring: 217.2 91.2% 59.8%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 2: Update `frontend/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PTChat",
  description: "Personal AI Chat with RAG",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build still passes**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: compiled successfully

- [ ] **Step 4: Commit + push**

```bash
cd ..
git add frontend/app/
git commit -m "feat: root layout with ThemeProvider"
git push origin feature/backend
```

---

## Task 4: Sidebar + Top Bar (Session Management)

**Files:**
- Create: `frontend/components/layout/app-sidebar.tsx`
- Create: `frontend/components/layout/top-bar.tsx`
- Create: `frontend/hooks/use-chat-stream.ts`

- [ ] **Step 1: Create `frontend/components/layout/app-sidebar.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, MessageSquare, FileText, Settings, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSessions, createSession, deleteSession, renameSession } from "@/lib/api";
import type { Session } from "@/lib/types";

interface AppSidebarProps {
  activeSessionId: string | null;
  onSessionSelect: (session: Session) => void;
  onSessionsChange?: () => void;
}

const NAV_ITEMS = [
  { href: "/", icon: MessageSquare, label: "Chat" },
  { href: "/documents", icon: FileText, label: "Documents" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function AppSidebar({ activeSessionId, onSessionSelect, onSessionsChange }: AppSidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const pathname = usePathname();

  const loadSessions = async () => {
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleNewSession = async () => {
    const session = await createSession({
      name: `Chat ${new Date().toLocaleTimeString()}`,
      llm_provider: "ollama",
      llm_model: "llama3",
    });
    setSessions((prev) => [session, ...prev]);
    onSessionSelect(session);
    onSessionsChange?.();
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    onSessionsChange?.();
  };

  const handleRenameSession = async (id: string) => {
    const name = prompt("Rename session:");
    if (!name) return;
    const updated = await renameSession(id, name);
    setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-lg">PTChat</span>
          <Button variant="ghost" size="icon" onClick={handleNewSession} title="New chat">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sessions */}
        <SidebarGroup>
          <SidebarGroupLabel>Sessions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sessions.map((session) => (
                <SidebarMenuItem key={session.id}>
                  <SidebarMenuButton
                    isActive={session.id === activeSessionId}
                    onClick={() => onSessionSelect(session)}
                    className="cursor-pointer"
                  >
                    <MessageSquare className="h-3 w-3 shrink-0" />
                    <span className="truncate text-sm">{session.name}</span>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction>
                        <MoreHorizontal className="h-3 w-3" />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right">
                      <DropdownMenuItem onClick={() => handleRenameSession(session.id)}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => handleDeleteSession(session.id, e)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
              {sessions.length === 0 && (
                <p className="px-2 py-4 text-xs text-muted-foreground">
                  No sessions yet. Click + to start.
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
```

- [ ] **Step 2: Create `frontend/components/layout/top-bar.tsx`**

```tsx
"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Session, Provider } from "@/lib/types";

interface TopBarProps {
  session: Session | null;
  providers: Provider[];
  onProviderChange: (provider: string, model: string) => void;
}

export function TopBar({ session, providers, onProviderChange }: TopBarProps) {
  const currentProvider = providers.find((p) => p.name === session?.llm_provider);
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
```

- [ ] **Step 3: Create `frontend/hooks/use-chat-stream.ts`**

```typescript
"use client";

import { useState, useCallback } from "react";

const BASE = "http://localhost:8000";

export interface StreamMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export function useChatStream(sessionId: string | null) {
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(
    async (content: string, onToken: (token: string) => void, onDone: (full: string) => void) => {
      if (!sessionId) return;
      setIsStreaming(true);
      setStreamingContent("");

      const res = await fetch(`${BASE}/sessions/${sessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok || !res.body) {
        setIsStreaming(false);
        throw new Error(`Chat request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const { token } = JSON.parse(data) as { token: string };
              fullContent += token;
              setStreamingContent(fullContent);
              onToken(token);
            } catch {
              // skip malformed line
            }
          }
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        onDone(fullContent);
      }
    },
    [sessionId]
  );

  return { sendMessage, isStreaming, streamingContent };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only minor warnings)

- [ ] **Step 5: Commit + push**

```bash
cd ..
git add frontend/components/layout/ frontend/hooks/
git commit -m "feat: sidebar with session management + top bar + SSE hook"
git push origin feature/backend
```

---

## Task 5: Settings Page

**Files:**
- Create: `frontend/components/settings/api-key-field.tsx`
- Create: `frontend/components/settings/theme-switcher.tsx`
- Create: `frontend/app/settings/page.tsx`

- [ ] **Step 1: Create `frontend/components/settings/api-key-field.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `frontend/components/settings/theme-switcher.tsx`**

```tsx
"use client";

import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-1.5">
      <Label>Theme</Label>
      <Select value={theme ?? "system"} onValueChange={setTheme}>
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
```

- [ ] **Step 3: Create `frontend/app/settings/page.tsx`**

```tsx
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
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit + push**

```bash
cd ..
git add frontend/components/settings/ frontend/app/settings/
git commit -m "feat: settings page — API keys, theme switcher, Ollama endpoint"
git push origin feature/backend
```

---

## Task 6: Documents Page

**Files:**
- Create: `frontend/components/documents/file-upload-zone.tsx`
- Create: `frontend/components/documents/document-table.tsx`
- Create: `frontend/components/documents/folder-monitor.tsx`
- Create: `frontend/app/documents/page.tsx`

- [ ] **Step 1: Create `frontend/components/documents/file-upload-zone.tsx`**

```tsx
"use client";

import { useCallback, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { uploadDocument } from "@/lib/api";
import type { Document } from "@/lib/types";

interface FileUploadZoneProps {
  onUploaded: (doc: Document) => void;
}

export function FileUploadZone({ onUploaded }: FileUploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const doc = await uploadDocument(file);
        onUploaded(doc);
      }
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
        dragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50"
      }`}
    >
      {uploading ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : (
        <>
          <Upload className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Drop files here or click to upload</p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports PDF, images, video, audio, code, and text files
          </p>
        </>
      )}
      <input
        type="file"
        multiple
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/components/documents/document-table.tsx`**

```tsx
"use client";

import { Trash2, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteDocument } from "@/lib/api";
import type { Document } from "@/lib/types";

interface DocumentTableProps {
  documents: Document[];
  onDeleted: (id: string) => void;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  processing: { label: "Processing", variant: "secondary" },
  ready: { label: "Ready", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
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
          {documents.map((doc) => {
            const status = STATUS_MAP[doc.status] ?? STATUS_MAP.failed;
            return (
              <tr key={doc.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2 max-w-xs truncate">{doc.name}</td>
                <td className="px-4 py-2 text-muted-foreground uppercase text-xs">{doc.file_type}</td>
                <td className="px-4 py-2 text-muted-foreground">{formatBytes(doc.size_bytes)}</td>
                <td className="px-4 py-2">
                  <Badge variant={status.variant}>{status.label}</Badge>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/components/documents/folder-monitor.tsx`**

```tsx
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
```

- [ ] **Step 4: Create `frontend/app/documents/page.tsx`**

```tsx
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
```

- [ ] **Step 5: Commit + push**

```bash
cd ..
git add frontend/components/documents/ frontend/app/documents/
git commit -m "feat: documents page — upload, list, folder monitoring"
git push origin feature/backend
```

---

## Task 7: Chat Page (Empty State + Spotlight)

**Files:**
- Create: `frontend/components/chat/empty-state.tsx`
- Create: `frontend/components/chat/message-bubble.tsx`
- Create: `frontend/components/chat/message-list.tsx`
- Create: `frontend/components/chat/chat-input.tsx`
- Create: `frontend/__tests__/components/message-bubble.test.tsx`
- Create: `frontend/__tests__/components/chat-input.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `frontend/__tests__/components/message-bubble.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { describe, it, expect } from "vitest";

describe("MessageBubble", () => {
  it("renders user message on the right", () => {
    render(
      <MessageBubble
        role="user"
        content="Hello"
        streaming={false}
      />
    );
    const el = screen.getByText("Hello");
    expect(el).toBeInTheDocument();
  });

  it("renders assistant message with markdown", () => {
    render(
      <MessageBubble
        role="assistant"
        content="**bold text**"
        streaming={false}
      />
    );
    const bold = screen.getByText("bold text");
    expect(bold.tagName).toBe("STRONG");
  });

  it("shows streaming cursor when streaming=true", () => {
    render(
      <MessageBubble
        role="assistant"
        content="Typing..."
        streaming={true}
      />
    );
    const cursor = document.querySelector(".animate-pulse");
    expect(cursor).toBeInTheDocument();
  });
});
```

Create `frontend/__tests__/components/chat-input.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInput } from "@/components/chat/chat-input";
import { describe, it, expect, vi } from "vitest";

describe("ChatInput", () => {
  it("calls onSend with the message when Enter is pressed", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByPlaceholderText(/message/i);
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("does not send on Shift+Enter (inserts newline)", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByPlaceholderText(/message/i);
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("is disabled when disabled=true", () => {
    render(<ChatInput onSend={vi.fn()} disabled={true} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
```

Run to verify they fail:
```bash
cd frontend && npm test 2>&1 | tail -10
```

Expected: component not found errors

- [ ] **Step 2: Create `frontend/components/chat/empty-state.tsx`** (Aceternity Spotlight)

```tsx
"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function EmptyState() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
      {/* Spotlight effect */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--primary) / 0.12), transparent)",
        }}
      />

      {/* Animated orb */}
      <motion.div
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute h-64 w-64 rounded-full bg-primary/5 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative flex flex-col items-center gap-4 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-background shadow-sm">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Start a conversation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a session or create a new one to begin chatting.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/components/chat/message-bubble.tsx`**

```tsx
"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";
import "highlight.js/styles/github-dark.css";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}

export function MessageBubble({ role, content, streaming = false }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
              {content}
            </ReactMarkdown>
            {streaming && (
              <span className="inline-block h-4 w-0.5 bg-current animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/components/chat/message-list.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message } from "@/lib/types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface MessageListProps {
  messages: DisplayMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            streaming={msg.streaming}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 5: Create `frontend/components/chat/chat-input.tsx`**

```tsx
"use client";

import { useState, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    ref.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t bg-background px-4 py-3">
      <div className="mx-auto flex max-w-2xl items-end gap-2">
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message… (Enter to send, Shift+Enter for newline)"
          disabled={disabled}
          rows={1}
          className="min-h-[44px] max-h-40 resize-none"
        />
        <Button
          size="icon"
          onClick={submit}
          disabled={!value.trim() || disabled}
          className="shrink-0 h-11 w-11"
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests — expect pass**

```bash
cd frontend && npm test 2>&1 | tail -15
```

Expected: all tests pass (6 tests: 3 api + 3 message-bubble + 3 chat-input... total depends on count)

- [ ] **Step 7: Commit + push**

```bash
cd ..
git add frontend/components/chat/ frontend/__tests__/components/
git commit -m "feat: chat components — message bubble, list, input, empty state"
git push origin feature/backend
```

---

## Task 8: Chat Page (Full Integration)

**Files:**
- Create: `frontend/app/page.tsx` (main chat page)

- [ ] **Step 1: Create `frontend/app/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { EmptyState } from "@/components/chat/empty-state";
import { useChatStream } from "@/hooks/use-chat-stream";
import { getMessages, getProviders } from "@/lib/api";
import type { Session, Message, Provider } from "@/lib/types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export default function ChatPage() {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const { sendMessage, isStreaming } = useChatStream(activeSession?.id ?? null);

  // Load providers on mount
  useEffect(() => {
    getProviders().then(setProviders).catch(console.error);
  }, []);

  // Load messages when session changes
  useEffect(() => {
    if (!activeSession) {
      setMessages([]);
      return;
    }
    getMessages(activeSession.id)
      .then((msgs) =>
        setMessages(
          msgs
            .filter((m): m is Message & { role: "user" | "assistant" } =>
              m.role === "user" || m.role === "assistant"
            )
            .map((m) => ({ id: m.id, role: m.role, content: m.content }))
        )
      )
      .catch(console.error);
  }, [activeSession]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!activeSession) return;

      // Optimistically add user message
      const userMsgId = `local-user-${Date.now()}`;
      const assistantMsgId = `local-assistant-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content },
        { id: assistantMsgId, role: "assistant", content: "", streaming: true },
      ]);

      try {
        await sendMessage(
          content,
          (token) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + token }
                  : m
              )
            );
          },
          (full) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: full, streaming: false }
                  : m
              )
            );
          }
        );
      } catch (err) {
        console.error("Chat error", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: "Error: failed to get response.", streaming: false }
              : m
          )
        );
      }
    },
    [activeSession, sendMessage]
  );

  const handleProviderChange = (provider: string, model: string) => {
    if (!activeSession) return;
    setActiveSession({ ...activeSession, llm_provider: provider, llm_model: model });
    // Note: backend session update for provider/model change can be added later
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar
          activeSessionId={activeSession?.id ?? null}
          onSessionSelect={(session) => setActiveSession(session)}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center border-b">
            <SidebarTrigger className="ml-2" />
            <div className="flex-1">
              <TopBar
                session={activeSession}
                providers={providers}
                onProviderChange={handleProviderChange}
              />
            </div>
          </div>

          {activeSession ? (
            <>
              <MessageList messages={messages} />
              <ChatInput onSend={handleSend} disabled={isStreaming} />
            </>
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2: Run the full test suite**

```bash
cd frontend && npm test
```

Expected: all tests pass

- [ ] **Step 3: Run a build to catch TypeScript errors**

```bash
npm run build 2>&1 | tail -10
```

Expected: compiled successfully

- [ ] **Step 4: Commit + push**

```bash
cd ..
git add frontend/app/page.tsx
git commit -m "feat: main chat page with SSE streaming and session management"
git push origin feature/backend
```

---

## Task 9: Final Smoke Test

- [ ] **Step 1: Start the backend**

```bash
cd /Users/peiwen/Projects/ptchat/.worktrees/backend/backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 &
```

- [ ] **Step 2: Start the frontend**

```bash
cd /Users/peiwen/Projects/ptchat/.worktrees/backend/frontend
npm run dev
```

Open http://localhost:3000

- [ ] **Step 3: Manual verification checklist**

- [ ] Home page loads without errors (Spotlight effect visible)
- [ ] Click + in sidebar → new session created
- [ ] Session appears in sidebar list
- [ ] Type a message → sends to backend (check network tab: POST /sessions/{id}/chat)
- [ ] AI response streams in token by token
- [ ] Navigate to /documents → page loads
- [ ] Upload a file → appears in document list with "processing" badge
- [ ] Navigate to /settings → page loads
- [ ] Theme toggle switches dark/light mode
- [ ] API key field shows masked input

- [ ] **Step 4: Final commit + push**

```bash
cd /Users/peiwen/Projects/ptchat/.worktrees/backend
git add -A
git commit -m "feat: frontend complete — chat, documents, settings pages"
git push origin feature/backend
```

---

## Done

Frontend implementation complete. The app runs at http://localhost:3000.

**API contracts consumed:**
- All 14 backend endpoints used
- SSE streaming chat with token-by-token display
- Dark/light/system theme via next-themes
- shadcn/ui components throughout
- Aceternity-style Spotlight animation on empty state
