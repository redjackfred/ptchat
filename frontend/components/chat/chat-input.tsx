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
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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
