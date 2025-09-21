-- Fix permissions for documents tables
-- Enable RLS on all document tables
ALTER TABLE documents_parent ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents_coach ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents_shared ENABLE ROW LEVEL SECURITY;

-- Create policies for anon users to read documents
CREATE POLICY "Enable read access for all users" ON documents_parent
    FOR SELECT USING (true);
    
CREATE POLICY "Enable read access for all users" ON documents_coach
    FOR SELECT USING (true);
    
CREATE POLICY "Enable read access for all users" ON documents_shared
    FOR SELECT USING (true);

-- Grant permissions to anon role
GRANT SELECT ON documents_parent TO anon;
GRANT SELECT ON documents_coach TO anon;
GRANT SELECT ON documents_shared TO anon;

-- Also check if tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('documents_parent', 'documents_coach', 'documents_shared')
ORDER BY table_name;
