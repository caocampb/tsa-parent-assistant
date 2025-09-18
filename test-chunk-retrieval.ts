#!/usr/bin/env node

import { config } from 'dotenv';
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testChunkRetrieval(query: string) {
  console.log(`\n🔍 Testing: "${query}"`);
  
  // Generate embedding
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: query,
    dimensions: 1536  // Match database dimensions
  });
  
  const queryEmbedding = embeddingResponse.data[0].embedding;
  
  // Search parent chunks
  const { data: chunks, error } = await supabase.rpc('search_documents_parent', {
    query_embedding: queryEmbedding,
    similarity_threshold: 0.4,  // Using the same threshold as your API
    match_count: 5
  });
  
  if (error) {
    console.log('❌ Error:', error);
    return;
  }
  
  console.log(`Found ${chunks?.length || 0} chunks above 0.4 threshold`);
  
  if (chunks && chunks.length > 0) {
    console.log(`Top match (${chunks[0].similarity.toFixed(3)}):`);
    console.log(chunks[0].content.substring(0, 150) + '...');
  } else {
    // Try with lower threshold
    const { data: lowerChunks } = await supabase.rpc('search_documents_parent', {
      query_embedding: queryEmbedding,
      similarity_threshold: 0.2,
      match_count: 5
    });
    
    if (lowerChunks && lowerChunks.length > 0) {
      console.log(`⚠️  Found chunks at lower threshold:`);
      lowerChunks.forEach((chunk, i) => {
        console.log(`  ${i+1}. Similarity ${chunk.similarity.toFixed(3)}: "${chunk.content.substring(0, 50)}..."`);
      });
    }
  }
}

async function main() {
  // Test queries that are failing
  await testChunkRetrieval("What is the monthly fee?");
  await testChunkRetrieval("monthly tuition");
  await testChunkRetrieval("how much per month");
  await testChunkRetrieval("cost");
  await testChunkRetrieval("$200");
  
  // Test what SHOULD work
  await testChunkRetrieval("Monthly Tuition");
  await testChunkRetrieval("FEES & PAYMENT");
}

main().catch(console.error);
