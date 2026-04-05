"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { useActiveSession } from "@/contexts/session-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { activeSession, setActiveSession } = useActiveSession();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar
          activeSessionId={activeSession?.id ?? null}
          onSessionSelect={setActiveSession}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex h-10 shrink-0 items-center border-b px-2">
            <SidebarTrigger />
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
