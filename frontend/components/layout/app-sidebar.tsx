"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, MessageSquare, FileText, Settings, MoreHorizontal, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
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

function SessionItem({
  session,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(session.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== session.name) onRename(trimmed);
    else setDraft(session.name);
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={onSelect}
        onDoubleClick={startEdit}
        className="cursor-pointer group/item"
      >
        <MessageSquare className="h-3 w-3 shrink-0" />
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setEditing(false); setDraft(session.name); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none border-b border-ring"
          />
        ) : (
          <span className="truncate text-sm">{session.name}</span>
        )}
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger render={<SidebarMenuAction />}>
          <MoreHorizontal className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right">
          <DropdownMenuItem onClick={startEdit}>Rename</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={onDelete}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ activeSessionId, onSessionSelect, onSessionsChange }: AppSidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [query, setQuery] = useState("");
  const pathname = usePathname();

  const filtered = useMemo(
    () => sessions.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [sessions, query]
  );

  const loadSessions = async () => {
    try {
      setSessions(await getSessions());
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  };

  useEffect(() => { loadSessions(); }, []);

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

  const handleRename = async (id: string, name: string) => {
    const updated = await renameSession(id, name);
    setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    onSessionsChange?.();
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    render={
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sessions</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="relative px-2 pb-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-md border border-input bg-transparent pl-7 pr-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-ring"
              />
            </div>
            <SidebarMenu>
              {filtered.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onSelect={() => onSessionSelect(session)}
                  onRename={(name) => handleRename(session.id, name)}
                  onDelete={() => handleDelete(session.id)}
                />
              ))}
              {sessions.length === 0 && (
                <p className="px-2 py-4 text-xs text-muted-foreground">
                  No sessions yet. Click + to start.
                </p>
              )}
              {sessions.length > 0 && filtered.length === 0 && (
                <p className="px-2 py-4 text-xs text-muted-foreground">No results.</p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
