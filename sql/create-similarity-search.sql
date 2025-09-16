-- Create a function for similarity search using pgvector
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float,
  page_number int,
  audio_timestamp float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id as chunk_id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity,
    dc.page_number,
    dc.audio_timestamp
  FROM document_chunks dc
  WHERE 1 - (dc.embedding <=> query_embedding) > similarity_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Test the function exists
SELECT proname, pronargs 
FROM pg_proc 
WHERE proname = 'search_documents';
