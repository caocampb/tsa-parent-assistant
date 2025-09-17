"use client";

import { useState, useEffect, type FormEvent } from "react";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

interface SearchBoxProps {
  placeholder?: string;
  className?: string;
  size?: "default" | "large";
  autoFocus?: boolean;
  showHelperText?: boolean;
  showAvatar?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

export function SearchBox({ 
  placeholder = "Ask any question about TSA...",
  className,
  size = "default",
  autoFocus = false,
  showHelperText = true,
  showAvatar = false,
  value,
  onValueChange,
  onSubmit
}: SearchBoxProps) {
  const [savedQuery, setSavedQuery] = useLocalStorage("tsa-search-draft", "");
  const [internalQuery, setInternalQuery] = useState(savedQuery);
  const [isFocused, setIsFocused] = useState(false);
  const [audience, setAudience] = useLocalStorage<'parent' | 'coach'>("tsa-audience", "parent");
  const router = useRouter();
  
  const query = value !== undefined ? value : internalQuery;
  const setQuery = onValueChange || ((val: string) => {
    setInternalQuery(val);
    setSavedQuery(val); // Auto-save to localStorage
  });

  // Clear saved query after successful submission
  useEffect(() => {
    if (value === "") {
      setSavedQuery("");
    }
  }, [value, setSavedQuery]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      if (onSubmit) {
        onSubmit(query);
        setSavedQuery(""); // Clear saved draft after submission
      } else {
        // Default navigation behavior
        const slug = query
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 50);
        
        router.push(`/q/${slug}?q=${encodeURIComponent(query)}&audience=${audience}`);
        setSavedQuery(""); // Clear saved draft after submission
      }
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Audience Toggle */}
      <div className="flex justify-center mb-3">
          <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
            <button
              type="button"
              onClick={() => setAudience('parent')}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                audience === 'parent' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "hover:bg-background/50 hover:text-foreground"
              )}
            >
              I'm a Parent
            </button>
            <button
              type="button"
              onClick={() => setAudience('coach')}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                audience === 'coach' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "hover:bg-background/50 hover:text-foreground"
              )}
            >
              I'm a Coach
            </button>
          </div>
        </div>
      
      <form onSubmit={handleSubmit}>
        <div
        className={cn(
          "relative overflow-hidden transition-all duration-200 group",
          size === "large" ? "rounded-full" : "rounded-full",
          isFocused
            ? "ring-2 ring-tsa-blue border-transparent shadow-lg shadow-tsa-blue/10"
            : "border border-border/30",
          "bg-muted/50 hover:bg-muted/70 hover:border-border/50 hover:shadow-md"
        )}
      >
        {showAvatar ? (
          <div className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2",
            size === "large" ? "w-11 h-11" : "w-9 h-9"
          )}>
            <div className="w-full h-full rounded-full bg-tsa-blue/10 text-tsa-blue flex items-center justify-center font-medium text-[11px] transition-colors group-hover:bg-tsa-blue/20">
              TSA
            </div>
          </div>
        ) : (
          <SearchIcon 
            className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors",
              size === "large" ? "h-5 w-5" : "h-4 w-4",
              isFocused && "text-tsa-blue"
            )}
          />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            "w-full bg-transparent outline-none",
            size === "large" 
              ? showAvatar ? "pl-16 pr-14 py-5 text-lg placeholder:text-base" : "pl-12 pr-14 py-5 text-lg placeholder:text-base"
              : showAvatar ? "pl-14 pr-12 py-3.5 text-base placeholder:text-sm" : "pl-11 pr-12 py-3.5 text-base placeholder:text-sm",
            "placeholder:text-muted-foreground/70",
            "focus:placeholder:text-muted-foreground/50"
          )}
        />
        {/* Submit button - always visible, filled when there's text */}
        <button
          type="submit"
          disabled={!query}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2",
            "rounded-full transition-all",
            size === "large" ? "w-11 h-11" : "w-9 h-9",
            "flex items-center justify-center active:scale-95",
            query 
              ? "bg-tsa-blue text-white hover:bg-tsa-blue/90 hover:scale-105" 
              : "bg-transparent text-muted-foreground hover:text-muted-foreground/70"
          )}
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 20 20" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className={size === "large" ? "h-5 w-5" : "h-4 w-4"}
          >
            <path 
              d="M5 10L15 10M15 10L11 6M15 10L11 14" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      
        {/* Helper text for large search boxes */}
        {size === "large" && showHelperText && (
          <p className="mt-3 text-sm text-muted-foreground text-center">
            Get instant answers about schedules, policies, registration, and more
          </p>
        )}
      </form>
    </div>
  );
}
