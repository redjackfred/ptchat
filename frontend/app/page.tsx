"use client";

import { useEffect, useState, useCallback } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { EmptyState } from "@/components/chat/empty-state";
import { useChatStream } from "@/hooks/use-chat-stream";
import { getMessages, getProviders, updateSessionModel, createSession } from "@/lib/api";
import { useActiveSession } from "@/contexts/session-context";
import type { Message, Provider } from "@/lib/types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  streaming?: boolean;
}

export default function ChatPage() {
  const { activeSession, setActiveSession } = useActiveSession();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const { sendMessage, isStreaming } = useChatStream(activeSession?.id ?? null);

  useEffect(() => {
    getProviders().then(setProviders).catch(console.error);
  }, []);

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
    async (content: string, images: string[] = []) => {
      if (!activeSession) return;

      const userMsgId = `local-user-${Date.now()}`;
      const assistantMsgId = `local-assistant-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content, images },
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
          },
          images,
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

  const handleNewChat = async () => {
    const session = await createSession({
      name: `Chat ${new Date().toLocaleTimeString()}`,
      llm_provider: "openai",
      llm_model: "gpt-4o-mini",
    });
    setActiveSession(session);
  };

  const handleProviderChange = async (provider: string, model: string) => {
    if (!activeSession) return;
    setActiveSession({ ...activeSession, llm_provider: provider, llm_model: model });
    try {
      await updateSessionModel(activeSession.id, provider, model);
    } catch (err) {
      console.error("Failed to update session model", err);
    }
  };

  return (
    <>
      <TopBar
        session={activeSession}
        providers={providers}
        onProviderChange={handleProviderChange}
      />
      {activeSession ? (
        <>
          <MessageList messages={messages} />
          <ChatInput onSend={handleSend} disabled={isStreaming} />
        </>
      ) : (
        <EmptyState onNewChat={handleNewChat} />
      )}
    </>
  );
}
