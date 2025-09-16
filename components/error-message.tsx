import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorMessageProps {
  error?: string;
  onRetry?: () => void;
}

export function ErrorMessage({ 
  error = "Sorry, something went wrong. Please try again.", 
  onRetry 
}: ErrorMessageProps) {
  return (
    <div className="group flex w-full justify-start is-assistant">
      <div className="max-w-[80%] px-4 py-3 bg-destructive/10 text-destructive-foreground rounded-2xl rounded-bl-md border border-destructive/20">
        <div className="flex items-start gap-2">
          <AlertCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Unable to respond</p>
            <p className="text-sm mt-1 opacity-90">{error}</p>
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="mt-3 h-8 text-xs border-destructive/20 hover:bg-destructive/5"
              >
                <RefreshCwIcon className="w-3 h-3 mr-1.5" />
                Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
