"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDownIcon } from "lucide-react";

interface ChatContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function ChatContainer({ children, className }: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [children]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative flex-1">
      <div
        ref={scrollRef}
        className={cn(
          "h-[500px] overflow-y-auto bg-muted/20 rounded-t-2xl",
          className
        )}
      >
        <div className="flex flex-col gap-4 p-8">
          {children}
          <div ref={bottomRef} />
        </div>
      </div>
      
      {/* Scroll to bottom button - we'll add scroll detection later */}
      {/* <Button
        onClick={scrollToBottom}
        size="icon"
        variant="outline"
        className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
      >
        <ArrowDownIcon className="h-4 w-4" />
      </Button> */}
    </div>
  );
}
