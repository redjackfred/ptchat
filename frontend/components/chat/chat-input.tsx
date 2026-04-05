"use client";

import { useRef, useState } from "react";
import { ImagePlus, Send, Loader2, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSend: (content: string, images: string[]) => void;
  disabled: boolean;
}

function toDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await toDataURL(file);
    setImages((prev) => [...prev, dataUrl]);
  };

  const removeImage = (i: number) =>
    setImages((prev) => prev.filter((_, idx) => idx !== i));

  const submit = () => {
    const trimmed = value.trim();
    if ((!trimmed && images.length === 0) || disabled) return;
    onSend(trimmed, images);
    setValue("");
    setImages([]);
    textareaRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const onPaste = async (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith("image/")
    );
    for (const f of files) await addImage(f);
  };

  return (
    <div className="border-t bg-background px-4 py-3">
      <div className="mx-auto max-w-2xl space-y-2">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div key={i} className="relative group">
                <img
                  src={src}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover border"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              for (const f of Array.from(e.target.files ?? [])) await addImage(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0 h-11 w-11"
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            title="Attach image"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>

          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder="Message… (Enter to send, Shift+Enter for newline, paste image)"
            disabled={disabled}
            rows={1}
            className="min-h-[44px] max-h-40 resize-none"
          />

          <Button
            size="icon"
            onClick={submit}
            disabled={(value.trim() === "" && images.length === 0) || disabled}
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
    </div>
  );
}
