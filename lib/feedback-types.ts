// Types for the feedback system

export interface ChunkMetadata {
  chunk_ids: string[];
  chunk_scores: number[];
  chunk_sources: ('parent' | 'coach' | 'shared')[];
  search_type: 'qa_pair' | 'rag' | 'hybrid';
  confidence_score: number;
  response_time_ms?: number;
}

export interface FeedbackData {
  question: string;
  answer: string;
  audience: 'parent' | 'coach';
  chunkMetadata?: ChunkMetadata;
  feedback?: 'up' | 'down';
  model_used?: string;
  created_at?: Date;
}
