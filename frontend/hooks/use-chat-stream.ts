"use client";

import { useState, useCallback } from "react";

const BASE = "http://localhost:8000";

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
