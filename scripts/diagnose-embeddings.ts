#!/usr/bin/env bun

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function diagnose() {
  console.log('🔍 EMBEDDING SYSTEM DIAGNOSIS\n');
  
  // TEST 1: Can we generate embeddings?
  console.log('TEST 1: Generating embeddings');
  console.log('==============================');
  
  const testQuestion = "What is the dash system?";
  console.log(`Test question: "${testQuestion}"`);
  
  try {
    const embedding = await openai.embeddings.create({
      input: testQuestion,
      model: 'text-embedding-3-large',
      dimensions: 1536
    });
    
    console.log('✅ Embedding generated successfully');
    console.log(`   - Model: text-embedding-3-large`);
    console.log(`   - Dimensions: ${embedding.data[0].embedding.length}`);
    console.log(`   - First 5 values: ${embedding.data[0].embedding.slice(0, 5).join(', ')}`);
    
    // TEST 2: Can we query the database directly?
    console.log('\n\nTEST 2: Direct database query');
    console.log('==============================');
    
    // First, let's see what Q&A pairs we have about "dash"
    const { data: dashQAs, error: dashError } = await supabase
      .from('qa_pairs')
      .select('id, question, answer, audience')
      .ilike('question', '%dash%')
      .limit(5);
    
    if (dashError) {
      console.error('❌ Error querying Q&A pairs:', dashError);
    } else {
      console.log(`Found ${dashQAs?.length || 0} Q&A pairs with "dash":`);
      dashQAs?.forEach((qa, i) => {
        console.log(`\n${i + 1}. ID: ${qa.id}`);
        console.log(`   Q: ${qa.question}`);
        console.log(`   A: ${qa.answer.substring(0, 100)}...`);
        console.log(`   Audience: ${qa.audience}`);
      });
    }
    
    // TEST 3: Can we do a similarity search manually?
    console.log('\n\nTEST 3: Manual similarity search');
    console.log('================================');
    
    if (dashQAs && dashQAs.length > 0) {
      // Get the embedding for the first Q&A pair we found
      const { data: qaWithEmbedding, error: embError } = await supabase
        .from('qa_pairs')
        .select('id, question, embedding')
        .eq('id', dashQAs[0].id)
        .single();
      
      if (qaWithEmbedding && qaWithEmbedding.embedding) {
        console.log(`\nChecking if Q&A embedding exists for: "${qaWithEmbedding.question}"`);
        console.log(`✅ Embedding exists with ${qaWithEmbedding.embedding.length} dimensions`);
        
        // Now search for it using its own embedding - should return 1.0 similarity
        console.log('\nSearching for exact match using same embedding...');
        const { data: exactMatch, error: searchError } = await supabase.rpc('search_qa_pairs', {
          query_embedding: qaWithEmbedding.embedding,
          match_count: 1,
          similarity_threshold: 0.5,
          filter_audience: null
        });
        
        if (searchError) {
          console.error('❌ RPC search error:', searchError);
        } else if (exactMatch && exactMatch.length > 0) {
          console.log('✅ Found match:');
          console.log(`   - Question: ${exactMatch[0].question}`);
          console.log(`   - Similarity: ${exactMatch[0].similarity}`);
          console.log(`   - Expected: ~1.0 (exact match)`);
          
          if (exactMatch[0].similarity < 0.99) {
            console.log('⚠️  WARNING: Exact match has low similarity! This indicates an embedding problem.');
          }
        } else {
          console.log('❌ No match found - RPC function may be broken');
        }
      }
    }
    
    // TEST 4: Search using our test question embedding
    console.log('\n\nTEST 4: Search with test question');
    console.log('=================================');
    console.log(`Searching for: "${testQuestion}"`);
    
    const { data: searchResults, error: searchError } = await supabase.rpc('search_qa_pairs', {
      query_embedding: embedding.data[0].embedding,
      match_count: 5,
      similarity_threshold: 0.5,
      filter_audience: null
    });
    
    if (searchError) {
      console.error('❌ Search error:', searchError);
    } else if (searchResults && searchResults.length > 0) {
      console.log(`\nFound ${searchResults.length} results:`);
      searchResults.forEach((result: any, i: number) => {
        console.log(`\n${i + 1}. Similarity: ${result.similarity.toFixed(4)}`);
        console.log(`   Q: ${result.question}`);
        console.log(`   Audience: ${result.audience}`);
      });
    } else {
      console.log('❌ No results found');
    }
    
    // TEST 5: Check audience filtering
    console.log('\n\nTEST 5: Audience filtering');
    console.log('=========================');
    
    const audiences = ['parent', 'coach', 'both'];
    for (const aud of audiences) {
      const { data: audResults } = await supabase.rpc('search_qa_pairs', {
        query_embedding: embedding.data[0].embedding,
        match_count: 1,
        similarity_threshold: 0.5,
        filter_audience: aud
      });
      
      console.log(`\nAudience="${aud}": ${audResults?.length || 0} results`);
      if (audResults && audResults.length > 0) {
        console.log(`   Best match: ${audResults[0].question} (sim: ${audResults[0].similarity.toFixed(4)})`);
      }
    }
    
    // TEST 6: Verify embeddings are consistent
    console.log('\n\nTEST 6: Embedding consistency');
    console.log('=============================');
    
    // Generate embedding twice for same text
    const embed1 = await openai.embeddings.create({
      input: testQuestion,
      model: 'text-embedding-3-large',
      dimensions: 1536
    });
    
    const embed2 = await openai.embeddings.create({
      input: testQuestion,
      model: 'text-embedding-3-large',
      dimensions: 1536
    });
    
    // Calculate cosine similarity manually
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embed1.data[0].embedding.length; i++) {
      dotProduct += embed1.data[0].embedding[i] * embed2.data[0].embedding[i];
      norm1 += embed1.data[0].embedding[i] * embed1.data[0].embedding[i];
      norm2 += embed2.data[0].embedding[i] * embed2.data[0].embedding[i];
    }
    
    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    console.log(`Same text embedded twice similarity: ${similarity.toFixed(6)}`);
    console.log(`Expected: ~1.0 (should be identical)`);
    
    if (similarity < 0.9999) {
      console.log('⚠️  WARNING: Embeddings are not deterministic!');
    } else {
      console.log('✅ Embeddings are consistent');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run diagnosis
diagnose().catch(console.error);


