"use client";

import { useEffect, useState } from "react";
import { Plus, MessageSquare, FileText, Settings, MoreHorizontal } from "lucide-react";
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
                    <DropdownMenuTrigger render={<SidebarMenuAction />}>
                      <MoreHorizontal className="h-3 w-3" />
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
