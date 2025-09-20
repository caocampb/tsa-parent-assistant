-- Create answer feedback table for tracking user satisfaction
-- This enables the feedback loop: bad answers → thumbs down → admin fixes → better answers

CREATE TABLE IF NOT EXISTS answer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core Q&A data
  question text NOT NULL,
  answer text NOT NULL,
  audience text CHECK (audience IN ('parent', 'coach')) NOT NULL,
  
  -- Which chunks were used (critical for analysis)
  chunk_ids uuid[] DEFAULT '{}',
  chunk_scores float[] DEFAULT '{}',
  chunk_sources text[] DEFAULT '{}', -- 'parent', 'coach', or 'shared'
  
  -- User feedback
  feedback text CHECK (feedback IN ('up', 'down')),
  
  -- Metadata for debugging
  response_time_ms integer,
  model_used text DEFAULT 'gpt-5-mini',
  search_type text CHECK (search_type IN ('qa_pair', 'rag', 'hybrid')),
  confidence_score float, -- Top chunk similarity score
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_feedback_created ON answer_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_question ON answer_feedback(question);
CREATE INDEX IF NOT EXISTS idx_feedback_chunks ON answer_feedback USING GIN(chunk_ids);
CREATE INDEX IF NOT EXISTS idx_feedback_audience ON answer_feedback(audience, feedback);

-- Helper view for the "Check Issues" button
CREATE OR REPLACE VIEW recent_feedback_issues AS
SELECT 
  question,
  audience,
  COUNT(*) as total_asks,
  COUNT(*) FILTER (WHERE feedback = 'down') as thumbs_down,
  COUNT(*) FILTER (WHERE feedback = 'up') as thumbs_up,
  MAX(created_at) as last_asked
FROM answer_feedback
WHERE created_at > now() - interval '7 days'
GROUP BY question, audience
HAVING COUNT(*) FILTER (WHERE feedback = 'down') > 0
ORDER BY thumbs_down DESC, total_asks DESC;

-- Test the table with sample data (delete after testing)
INSERT INTO answer_feedback (question, answer, audience, feedback)
VALUES 
  ('When does spring registration open?', 'Spring registration opens...', 'parent', 'down'),
  ('When does spring registration open?', 'Spring registration opens...', 'parent', 'down'),
  ('How much are monthly fees?', 'Monthly fees are...', 'parent', 'down');
