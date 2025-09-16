import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MessageProps {
  content: string;
  role: "user" | "assistant";
  source?: string;
}

export function Message({ content, role, source }: MessageProps) {
  return (
    <div
      className={cn(
        "group flex w-full",
        role === "user" ? "justify-end" : "justify-start",
        role === "user" ? "is-user" : "is-assistant"
      )}
    >
      <div className="max-w-[80%] px-4 py-3 text-sm
        group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground group-[.is-user]:rounded-2xl group-[.is-user]:rounded-br-md
        group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-secondary-foreground group-[.is-assistant]:rounded-2xl group-[.is-assistant]:rounded-bl-md"
      >
        <p>{content}</p>
        {source && role === "assistant" && (
          <p className="mt-2 text-xs text-muted-foreground/70">
            From {source}
          </p>
        )}
      </div>
    </div>
  );
}
