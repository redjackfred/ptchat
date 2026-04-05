"use client";

import { createContext, useContext, useState } from "react";
import type { Session } from "@/lib/types";

interface SessionContextType {
  activeSession: Session | null;
  setActiveSession: (s: Session | null) => void;
}

const SessionContext = createContext<SessionContextType>({
  activeSession: null,
  setActiveSession: () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  return (
    <SessionContext.Provider value={{ activeSession, setActiveSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useActiveSession = () => useContext(SessionContext);
