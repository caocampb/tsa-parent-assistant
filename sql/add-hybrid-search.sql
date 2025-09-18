-- Add full-text search capabilities to document tables
-- This migration adds tsvector columns and indexes for efficient text search

-- Add tsvector columns to parent documents
ALTER TABLE document_chunks_parent 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Update existing rows with search vectors
UPDATE document_chunks_parent 
SET search_vector = to_tsvector('english', content);

-- Create GIN index for fast text search
CREATE INDEX IF NOT EXISTS idx_parent_search_vector 
ON document_chunks_parent USING GIN(search_vector);

-- Add trigger to automatically update search vector on insert/update
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.content);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_parent_search_vector 
BEFORE INSERT OR UPDATE ON document_chunks_parent
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Repeat for coach documents
ALTER TABLE document_chunks_coach 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE document_chunks_coach 
SET search_vector = to_tsvector('english', content);

CREATE INDEX IF NOT EXISTS idx_coach_search_vector 
ON document_chunks_coach USING GIN(search_vector);

CREATE TRIGGER update_coach_search_vector 
BEFORE INSERT OR UPDATE ON document_chunks_coach
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Repeat for shared documents
ALTER TABLE document_chunks_shared 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE document_chunks_shared 
SET search_vector = to_tsvector('english', content);

CREATE INDEX IF NOT EXISTS idx_shared_search_vector 
ON document_chunks_shared USING GIN(search_vector);

CREATE TRIGGER update_shared_search_vector 
BEFORE INSERT OR UPDATE ON document_chunks_shared
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Create hybrid search function for parent documents
CREATE OR REPLACE FUNCTION hybrid_search_documents_parent(
  query_embedding vector(1536),
  query_text text,
  similarity_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5,
  semantic_weight float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  content text,
  chunk_index int,
  document_id uuid,
  similarity float,
  keyword_rank real,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_search AS (
    SELECT 
      dcp.id,
      dcp.content,
      dcp.chunk_index,
      dcp.document_id,
      1 - (dcp.embedding <=> query_embedding) AS similarity
    FROM document_chunks_parent dcp
    WHERE 1 - (dcp.embedding <=> query_embedding) > similarity_threshold
    ORDER BY dcp.embedding <=> query_embedding
    LIMIT match_count * 2  -- Get more candidates for re-ranking
  ),
  keyword_search AS (
    SELECT 
      dcp.id,
      ts_rank(dcp.search_vector, plainto_tsquery('english', query_text)) AS rank
    FROM document_chunks_parent dcp
    WHERE dcp.search_vector @@ plainto_tsquery('english', query_text)
  ),
  combined AS (
    SELECT 
      ss.id,
      ss.content,
      ss.chunk_index,
      ss.document_id,
      ss.similarity,
      COALESCE(ks.rank, 0) AS keyword_rank,
      -- Normalize keyword rank to 0-1 scale and combine
      (semantic_weight * ss.similarity) + 
      ((1 - semantic_weight) * LEAST(COALESCE(ks.rank, 0) * 10, 1)) AS combined_score
    FROM semantic_search ss
    LEFT JOIN keyword_search ks ON ss.id = ks.id
  )
  SELECT * FROM combined
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Create hybrid search function for coach documents
CREATE OR REPLACE FUNCTION hybrid_search_documents_coach(
  query_embedding vector(1536),
  query_text text,
  similarity_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5,
  semantic_weight float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  content text,
  chunk_index int,
  document_id uuid,
  similarity float,
  keyword_rank real,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_search AS (
    SELECT 
      dcc.id,
      dcc.content,
      dcc.chunk_index,
      dcc.document_id,
      1 - (dcc.embedding <=> query_embedding) AS similarity
    FROM document_chunks_coach dcc
    WHERE 1 - (dcc.embedding <=> query_embedding) > similarity_threshold
    ORDER BY dcc.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_search AS (
    SELECT 
      dcc.id,
      ts_rank(dcc.search_vector, plainto_tsquery('english', query_text)) AS rank
    FROM document_chunks_coach dcc
    WHERE dcc.search_vector @@ plainto_tsquery('english', query_text)
  ),
  combined AS (
    SELECT 
      ss.id,
      ss.content,
      ss.chunk_index,
      ss.document_id,
      ss.similarity,
      COALESCE(ks.rank, 0) AS keyword_rank,
      (semantic_weight * ss.similarity) + 
      ((1 - semantic_weight) * LEAST(COALESCE(ks.rank, 0) * 10, 1)) AS combined_score
    FROM semantic_search ss
    LEFT JOIN keyword_search ks ON ss.id = ks.id
  )
  SELECT * FROM combined
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Create hybrid search function for shared documents
CREATE OR REPLACE FUNCTION hybrid_search_documents_shared(
  query_embedding vector(1536),
  query_text text,
  similarity_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5,
  semantic_weight float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  content text,
  chunk_index int,
  document_id uuid,
  similarity float,
  keyword_rank real,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_search AS (
    SELECT 
      dcs.id,
      dcs.content,
      dcs.chunk_index,
      dcs.document_id,
      1 - (dcs.embedding <=> query_embedding) AS similarity
    FROM document_chunks_shared dcs
    WHERE 1 - (dcs.embedding <=> query_embedding) > similarity_threshold
    ORDER BY dcs.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_search AS (
    SELECT 
      dcs.id,
      ts_rank(dcs.search_vector, plainto_tsquery('english', query_text)) AS rank
    FROM document_chunks_shared dcs
    WHERE dcs.search_vector @@ plainto_tsquery('english', query_text)
  ),
  combined AS (
    SELECT 
      ss.id,
      ss.content,
      ss.chunk_index,
      ss.document_id,
      ss.similarity,
      COALESCE(ks.rank, 0) AS keyword_rank,
      (semantic_weight * ss.similarity) + 
      ((1 - semantic_weight) * LEAST(COALESCE(ks.rank, 0) * 10, 1)) AS combined_score
    FROM semantic_search ss
    LEFT JOIN keyword_search ks ON ss.id = ks.id
  )
  SELECT * FROM combined
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;
