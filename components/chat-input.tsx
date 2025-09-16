"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="relative w-full overflow-hidden rounded-2xl border bg-background shadow-sm hover:shadow-md transition-shadow"
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about schedules, registration, policies..."
        disabled={disabled}
        className={cn(
          "w-full resize-none border-0 bg-transparent px-4 py-3 pr-12",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-0",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled}
        className={cn(
          "absolute right-2 bottom-2 h-8 w-8 rounded-full transition-all",
          input.trim() 
            ? "bg-primary hover:bg-primary/90 hover:scale-105 text-primary-foreground" 
            : "bg-primary/20 hover:bg-primary/30 text-primary/50 cursor-not-allowed",
          "disabled:bg-muted disabled:text-muted-foreground"
        )}
        onClick={(e) => {
          if (!input.trim()) {
            e.preventDefault();
          }
        }}
      >
        <ArrowUpIcon className="h-4 w-4" />
      </Button>
    </form>
  );
}
