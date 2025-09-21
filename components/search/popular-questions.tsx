"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { type Question } from "@/lib/types";
import { 
  CalendarIcon, 
  DollarSignIcon, 
  ShirtIcon,
  FileTextIcon,
  ClockIcon,
  CalendarDaysIcon,
  type LucideIcon
} from "lucide-react";

interface PopularQuestionsProps {
  questions: Question[];
  className?: string;
}

// Map categories to icons
const categoryIcons: Partial<Record<Question["category"], LucideIcon>> = {
  schedule: ClockIcon,
  policy: FileTextIcon,
  registration: CalendarIcon,
  uniform: ShirtIcon,
  payment: DollarSignIcon,
  general: CalendarDaysIcon,
  platform: FileTextIcon,
  academic: FileTextIcon,
};

export function PopularQuestions({ questions, className }: PopularQuestionsProps) {
  return (
    <div className={cn("w-full", className)}>
      <h2 className="text-sm font-medium text-muted-foreground mb-4">
        Popular questions
      </h2>
      
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {questions.map((question) => {
          const Icon = categoryIcons[question.category] || FileTextIcon;
          
          return (
            <Link
              key={question.id}
              href={`/q/${question.slug}?q=${encodeURIComponent(question.text)}`}
              className={cn(
                "group relative rounded-xl border bg-background p-4",
                "transition-all duration-200",
                "hover:shadow-md hover:border-primary/30",
                "hover:bg-primary/[0.02]"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "rounded-lg p-2 transition-colors",
                  "bg-muted group-hover:bg-primary/10"
                )}>
                  <Icon className="h-4 w-4 text-primary/70 group-hover:text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {question.text}
                  </h3>
                  
                  <p className="mt-1 text-xs text-muted-foreground capitalize">
                    {question.category}
                  </p>
                </div>
              </div>
              
              {/* Subtle arrow indicator */}
              <div className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2",
                "opacity-0 group-hover:opacity-100 transition-opacity",
                "text-muted-foreground"
              )}>
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 16 16" 
                  fill="none"
                  className="h-4 w-4"
                >
                  <path 
                    d="M6 12L10 8L6 4" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
      
      {/* View all questions link */}
      <div className="mt-6 text-center">
        <Link
          href="/questions"
          className={cn(
            "inline-flex items-center gap-1.5 text-sm text-muted-foreground",
            "hover:text-primary transition-colors"
          )}
        >
          View all questions
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 16 16" 
            fill="none"
            className="h-3.5 w-3.5"
          >
            <path 
              d="M6 12L10 8L6 4" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
