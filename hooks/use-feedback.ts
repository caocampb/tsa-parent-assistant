import { useState } from 'react';

interface FeedbackData {
  question: string;
  answer: string;
  audience: 'parent' | 'coach';
  feedback: 'up' | 'down';
  // Optional chunk metadata
  chunk_ids?: string[];
  chunk_scores?: number[];
  chunk_sources?: string[];
  search_type?: string;
  confidence_score?: number;
  response_time_ms?: number;
}

export function useFeedback() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const saveFeedback = async (data: FeedbackData) => {
    if (isSubmitting) return; // Prevent double submissions
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save feedback: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to save feedback:', error);
      }
      // Don't throw - feedback is non-critical
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return { saveFeedback, isSubmitting };
}
