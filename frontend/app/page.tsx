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
