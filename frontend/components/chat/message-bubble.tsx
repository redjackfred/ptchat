"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import "highlight.js/styles/github-dark.css";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  images?: string[];
  streaming?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="absolute right-2 top-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/code:opacity-100 hover:text-foreground hover:bg-muted"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

export function MessageBubble({ role, content, images = [], streaming = false }: MessageBubbleProps) {
  const isUser = role === "user";
  const isEmpty = content.trim() === "";

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
          <div className="space-y-2">
            {images.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {images.map((src, i) => (
                  <img key={i} src={src} alt="" className="max-h-48 rounded-lg object-contain" />
                ))}
              </div>
            )}
            {content && <p className="whitespace-pre-wrap">{content}</p>}
          </div>
        ) : streaming && isEmpty ? (
          <TypingIndicator />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              rehypePlugins={[rehypeHighlight]}
              components={{
                pre({ children, ...props }) {
                  const codeEl = (children as React.ReactElement)?.props;
                  const text = typeof codeEl?.children === "string" ? codeEl.children : "";
                  return (
                    <pre {...props} className={cn((props as { className?: string }).className, "relative group/code")}>
                      {children}
                      {text && <CopyButton text={text} />}
                    </pre>
                  );
                },
              }}
            >
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
