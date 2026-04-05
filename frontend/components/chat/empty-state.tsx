"use client";

import { motion } from "framer-motion";
import { Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onNewChat?: () => void;
}

export function EmptyState({ onNewChat }: EmptyStateProps) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
      {/* Spotlight effect */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--primary) / 0.12), transparent)",
        }}
      />

      {/* Animated orb */}
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute h-64 w-64 rounded-full bg-primary/5 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative flex flex-col items-center gap-4 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-background shadow-sm">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Start a conversation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a session or create a new one to begin chatting.
          </p>
        </div>
        {onNewChat && (
          <Button onClick={onNewChat} className="mt-2 gap-2">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        )}
      </motion.div>
    </div>
  );
}
