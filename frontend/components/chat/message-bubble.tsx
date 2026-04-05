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
