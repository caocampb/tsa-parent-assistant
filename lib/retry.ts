interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  onRetry?: (attempt: number, error: any) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    onRetry
  } = options;

  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(factor, attempt - 1),
        maxDelay
      );
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, error);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Helper to check if error is retryable
export function isRetryableError(error: any): boolean {
  // Network errors
  if (!navigator.onLine) return false; // Don't retry if offline
  
  // Timeout errors
  if (error?.name === 'AbortError') return true;
  
  // Server errors (5xx)
  if (error?.status >= 500 && error?.status < 600) return true;
  
  // Rate limiting (429)
  if (error?.status === 429) return true;
  
  return false;
}
