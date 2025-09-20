-- COMPLETE REBUILD SCRIPT FOR TSA RAG WITH AUDIENCE SEPARATION
-- Run this in Supabase SQL Editor

-- 1. Drop existing tables (if you want to start fresh)
DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS qa_pairs CASCADE;
DROP TABLE IF EXISTS questions CASCADE;

-- 2. Create parent-specific tables
CREATE TABLE documents_parent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  doc_type text NOT NULL DEFAULT 'handbook',
  uploaded_at timestamp DEFAULT now(),
  idempotency_key text UNIQUE
);

CREATE TABLE document_chunks_parent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents_parent(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  page_number integer,
  audio_timestamp double precision
);

-- 3. Create coach-specific tables
CREATE TABLE documents_coach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  doc_type text NOT NULL DEFAULT 'business',
  uploaded_at timestamp DEFAULT now(),
  idempotency_key text UNIQUE
);

CREATE TABLE document_chunks_coach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents_coach(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  page_number integer,
  audio_timestamp double precision
);

-- 4. Create shared/both audience table
CREATE TABLE documents_shared (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  doc_type text NOT NULL DEFAULT 'general',
  uploaded_at timestamp DEFAULT now(),
  idempotency_key text UNIQUE
);

CREATE TABLE document_chunks_shared (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents_shared(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  page_number integer,
  audio_timestamp double precision
);

-- 5. Recreate qa_pairs table (already has audience field!)
CREATE TABLE qa_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text CHECK (category IN ('logistics', 'real_estate', 'accreditation', 'academics', 'tuition_payments', 'vouchers_scholarships', 'school_ops', 'general_sales')),
  audience text CHECK (audience IN ('coach', 'parent', 'both')) NOT NULL,
  embedding vector(1536),
  created_at timestamp with time zone DEFAULT now()
);

-- 6. Create indexes for vector similarity search
CREATE INDEX idx_chunks_parent_embedding ON document_chunks_parent 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_chunks_coach_embedding ON document_chunks_coach 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_chunks_shared_embedding ON document_chunks_shared 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_qa_embedding ON qa_pairs 
USING hnsw (embedding vector_cosine_ops);

-- 7. Create indexes for filtering
CREATE INDEX idx_qa_category ON qa_pairs(category);
CREATE INDEX idx_qa_audience ON qa_pairs(audience);
CREATE INDEX idx_qa_category_audience ON qa_pairs(category, audience);

-- 8. Create RPC function for searching parent documents
CREATE OR REPLACE FUNCTION search_documents_parent(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.25
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float,
  page_number int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id as chunk_id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity,
    dc.page_number
  FROM document_chunks_parent dc
  WHERE 1 - (dc.embedding <=> query_embedding) > similarity_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 9. Create RPC function for searching coach documents
CREATE OR REPLACE FUNCTION search_documents_coach(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.25
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float,
  page_number int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id as chunk_id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity,
    dc.page_number
  FROM document_chunks_coach dc
  WHERE 1 - (dc.embedding <=> query_embedding) > similarity_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 10. Create RPC function for searching shared documents
CREATE OR REPLACE FUNCTION search_documents_shared(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.25
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float,
  page_number int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id as chunk_id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity,
    dc.page_number
  FROM document_chunks_shared dc
  WHERE 1 - (dc.embedding <=> query_embedding) > similarity_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 11. Reuse existing search_qa_pairs function (or recreate if needed)
CREATE OR REPLACE FUNCTION search_qa_pairs(
  query_embedding vector(1536),
  match_count int DEFAULT 3,
  similarity_threshold float DEFAULT 0.7,
  filter_audience text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  question text,
  answer text,
  category text,
  audience text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qa.id,
    qa.question,
    qa.answer,
    qa.category,
    qa.audience,
    1 - (qa.embedding <=> query_embedding) as similarity
  FROM qa_pairs qa
  WHERE 
    1 - (qa.embedding <=> query_embedding) > similarity_threshold
    AND (filter_audience IS NULL OR qa.audience = filter_audience OR qa.audience = 'both')
  ORDER BY qa.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 12. Grant permissions
ALTER TABLE documents_parent DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents_coach DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents_shared DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks_parent DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks_coach DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks_shared DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_pairs DISABLE ROW LEVEL SECURITY;

-- Grant permissions to roles
GRANT ALL ON documents_parent, documents_coach, documents_shared TO service_role;
GRANT ALL ON document_chunks_parent, document_chunks_coach, document_chunks_shared TO service_role;
GRANT ALL ON qa_pairs TO service_role;

GRANT SELECT ON documents_parent, documents_coach, documents_shared TO anon, authenticated;
GRANT SELECT ON document_chunks_parent, document_chunks_coach, document_chunks_shared TO anon, authenticated;
GRANT SELECT ON qa_pairs TO anon, authenticated;

GRANT EXECUTE ON FUNCTION search_documents_parent TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_documents_coach TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_documents_shared TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_qa_pairs TO anon, authenticated;










