import { ThumbsUpIcon, ThumbsDownIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useFeedback } from "@/hooks/use-feedback";

interface FeedbackButtonsProps {
  question: string;
  answer: string;
  audience: 'parent' | 'coach';
  messageId: string;
  currentFeedback?: 'up' | 'down' | null;
  onFeedbackChange?: (feedback: 'up' | 'down' | null) => void;
  chunkMetadata?: {
    chunk_ids?: string[];
    chunk_scores?: number[];
    chunk_sources?: string[];
    search_type?: string;
    confidence_score?: number;
    response_time_ms?: number;
  };
}

export function FeedbackButtons({
  question,
  answer,
  audience,
  messageId,
  currentFeedback,
  onFeedbackChange,
  chunkMetadata
}: FeedbackButtonsProps) {
  const { saveFeedback } = useFeedback();
  
  const handleFeedback = async (newFeedback: 'up' | 'down') => {
    const isToggleOff = currentFeedback === newFeedback;
    const feedbackValue = isToggleOff ? null : newFeedback;
    
    // Update UI
    onFeedbackChange?.(feedbackValue);
    
    // Save to database if setting feedback (not toggling off)
    if (!isToggleOff) {
      await saveFeedback({
        question,
        answer,
        audience,
        feedback: newFeedback,
        ...chunkMetadata
      });
      
      // Pulse animation
      const btn = document.getElementById(`feedback-${newFeedback}-${messageId}`);
      btn?.classList.add('animate-pulse');
      setTimeout(() => btn?.classList.remove('animate-pulse'), 600);
    }
  };
  
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleFeedback('up')}
            id={`feedback-up-${messageId}`}
            className={cn(
              "p-2 rounded-full transition-all duration-200 active:scale-95",
              currentFeedback === 'up' 
                ? "bg-tsa-blue/10 text-tsa-blue scale-110 ring-2 ring-tsa-blue/20" 
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-label="This was helpful"
          >
            <ThumbsUpIcon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{currentFeedback === 'up' ? "Remove feedback" : "This was helpful"}</p>
        </TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleFeedback('down')}
            id={`feedback-down-${messageId}`}
            className={cn(
              "p-2 rounded-full transition-all duration-200 active:scale-95",
              currentFeedback === 'down' 
                ? "bg-destructive/10 text-destructive scale-110 ring-2 ring-destructive/20" 
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-label="This wasn't helpful"
          >
            <ThumbsDownIcon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{currentFeedback === 'down' ? "Remove feedback" : "This wasn't helpful"}</p>
        </TooltipContent>
      </Tooltip>
    </>
  );
}
