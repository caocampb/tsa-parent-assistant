-- Enable Row Level Security but allow all operations for now
-- (In production, you'd want more restrictive policies)

-- Enable RLS on the table
ALTER TABLE answer_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for feedback operations
-- Allow anyone to insert feedback (users giving thumbs up/down)
CREATE POLICY "Allow feedback inserts" ON answer_feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow anyone to read feedback (for analytics)
CREATE POLICY "Allow feedback reads" ON answer_feedback
  FOR SELECT TO anon, authenticated
  USING (true);

-- Grant necessary permissions
GRANT SELECT ON answer_feedback TO anon, authenticated;
GRANT INSERT ON answer_feedback TO anon, authenticated;

-- Also grant permissions on the view
GRANT SELECT ON recent_feedback_issues TO anon, authenticated;
