import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

async function testRAG() {
  console.log('🧪 Testing RAG retrieval for Alpha School content...\n');
  
  // Test query that should find Alpha content
  const testQuery = "What specific life skills workshops do you offer in the afternoon?";
  
  console.log(`Query: "${testQuery}"\n`);
  
  // Generate embedding
  const embedding = await openai.embeddings.create({
    input: testQuery,
    model: 'text-embedding-3-large',
    dimensions: 1536
  });
  
  // Search document chunks
  const { data: chunks, error } = await supabase.rpc('search_documents_parent', {
    query_embedding: embedding.data[0].embedding,
    match_count: 3,
    similarity_threshold: 0.3
  });
  
  if (error) {
    console.log('Error:', error);
    return;
  }
  
  console.log(`Found ${chunks?.length || 0} relevant chunks:\n`);
  
  chunks?.forEach((chunk, i) => {
    console.log(`Chunk ${i + 1} (${(chunk.similarity * 100).toFixed(1)}% match):`);
    
    // Find and highlight the relevant part
    const keywords = ['workshop', 'afternoon', 'skills', 'entrepreneurship', 'financial'];
    let excerpt = chunk.content;
    
    // Try to find a relevant section
    for (const keyword of keywords) {
      const index = chunk.content.toLowerCase().indexOf(keyword);
      if (index > -1) {
        const start = Math.max(0, index - 100);
        const end = Math.min(chunk.content.length, index + 200);
        excerpt = '...' + chunk.content.substring(start, end) + '...';
        break;
      }
    }
    
    console.log(`"${excerpt}"`);
    console.log();
  });
  
  // Also check Q&A pairs
  const { data: qa } = await supabase.rpc('search_qa_pairs', {
    query_embedding: embedding.data[0].embedding,
    match_count: 1,
    similarity_threshold: 0.5,
    filter_audience: 'parent'
  });
  
  if (qa && qa.length > 0) {
    console.log(`\n🎯 Also found Q&A pair (${(qa[0].similarity * 100).toFixed(1)}% match):`);
    console.log(`Q: ${qa[0].question}`);
    console.log(`A: ${qa[0].answer}`);
  }
}

testRAG().catch(console.error);
