"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  fixed?: boolean;
  className?: string;
}

export function AppHeader({ fixed = false, className }: AppHeaderProps) {
  return (
    <header 
      className={cn(
        "px-6 py-5 z-40",
        fixed && "fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-sm",
        className
      )}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link 
            href="/" 
            className="text-base font-semibold text-tsa-blue hover:text-tsa-blue/80 transition-all duration-200 hover:scale-[1.02]"
          >
            Texas Sports Academy
          </Link>
        </div>
        
        <nav className="flex items-center gap-6 relative z-50">
          <a 
            href="/admin" 
            className="text-sm text-muted-foreground hover:text-tsa-blue transition-all duration-200 relative group"
          >
            Admin
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-tsa-blue transition-all duration-200 group-hover:w-full" />
          </a>
          <a
            href="https://texassportsacademy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-tsa-blue text-white rounded-full text-sm font-medium hover:bg-tsa-blue/90 hover:shadow-lg hover:scale-105 transition-all duration-200"
          >
            Visit TSA
          </a>
        </nav>
      </div>
    </header>
  );
}
