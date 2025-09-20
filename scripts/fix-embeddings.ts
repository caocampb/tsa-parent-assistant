#!/usr/bin/env bun

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Convert array to PostgreSQL array literal format
 * This is the proper way to insert vectors into Supabase
 */
function formatPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

async function fixQAPairs() {
  console.log('🔧 Fixing Q&A pair embeddings...\n');
  
  // Get all Q&A pairs
  const { data: qaPairs, error } = await supabase
    .from('qa_pairs')
    .select('id, question, embedding');
  
  if (error || !qaPairs) {
    console.error('Error fetching Q&A pairs:', error);
    return;
  }
  
  console.log(`Found ${qaPairs.length} Q&A pairs to check`);
  
  let fixedCount = 0;
  
  for (const qa of qaPairs) {
    // Check if embedding is stored as string (broken)
    if (typeof qa.embedding === 'string') {
      console.log(`\nFixing: ${qa.question.substring(0, 60)}...`);
      
      try {
        // Generate new embedding
        const embeddingResponse = await openai.embeddings.create({
          input: qa.question,
          model: 'text-embedding-3-large',
          dimensions: 1536
        });
        
        const embedding = embeddingResponse.data[0].embedding;
        
        // Update with proper format
        const { error: updateError } = await supabase
          .from('qa_pairs')
          .update({ 
            embedding: formatPgVector(embedding) as any 
          })
          .eq('id', qa.id);
        
        if (updateError) {
          console.error(`  ❌ Update failed:`, updateError);
        } else {
          console.log(`  ✅ Fixed`);
          fixedCount++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  ❌ Error:`, error);
      }
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} Q&A pairs`);
}

async function fixDocumentChunks(audience: 'parent' | 'coach' | 'shared') {
  console.log(`\n🔧 Fixing document chunks for ${audience}...`);
  
  const tableName = `document_chunks_${audience}`;
  const { data: chunks, error } = await supabase
    .from(tableName)
    .select('id, content, embedding');
  
  if (error || !chunks) {
    console.error(`Error fetching ${tableName}:`, error);
    return;
  }
  
  console.log(`Found ${chunks.length} chunks to check`);
  
  let fixedCount = 0;
  
  for (const chunk of chunks) {
    if (typeof chunk.embedding === 'string') {
      console.log(`\nFixing chunk ${chunk.id}`);
      
      try {
        // Generate new embedding
        const embeddingResponse = await openai.embeddings.create({
          input: chunk.content,
          model: 'text-embedding-3-large',
          dimensions: 1536
        });
        
        const embedding = embeddingResponse.data[0].embedding;
        
        // Update with proper format
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ 
            embedding: formatPgVector(embedding) as any 
          })
          .eq('id', chunk.id);
        
        if (updateError) {
          console.error(`  ❌ Update failed:`, updateError);
        } else {
          console.log(`  ✅ Fixed`);
          fixedCount++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  ❌ Error:`, error);
      }
    }
  }
  
  console.log(`✅ Fixed ${fixedCount} chunks in ${tableName}`);
}

async function verifyFix() {
  console.log('\n🔍 Verifying fix...');
  
  // Test a search
  const testQuestion = "What is the dash system?";
  const embedding = await openai.embeddings.create({
    input: testQuestion,
    model: 'text-embedding-3-large',
    dimensions: 1536
  });
  
  const { data: results, error } = await supabase.rpc('search_qa_pairs', {
    query_embedding: embedding.data[0].embedding,
    match_count: 3,
    similarity_threshold: 0.5,
    filter_audience: null
  });
  
  if (error) {
    console.error('Search error:', error);
  } else if (results && results.length > 0) {
    console.log('\n✅ Search working! Results:');
    results.forEach((r: any, i: number) => {
      console.log(`${i + 1}. ${r.question} (similarity: ${r.similarity.toFixed(4)})`);
    });
  } else {
    console.log('❌ No results found');
  }
}

// Run the fix
async function main() {
  console.log('🚀 Starting embedding fix process...\n');
  
  // Fix Q&A pairs
  await fixQAPairs();
  
  // Fix document chunks for each audience
  await fixDocumentChunks('parent');
  await fixDocumentChunks('coach');
  await fixDocumentChunks('shared');
  
  // Verify the fix worked
  await verifyFix();
  
  console.log('\n✅ Fix process complete!');
}

main().catch(console.error);


