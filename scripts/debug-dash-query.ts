#!/usr/bin/env bun

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Copy the generateQueryVariations function to test it
function generateQueryVariations(question: string): string[] {
  const variations = [question];
  
  const noPunctuation = question.replace(/[?!.]$/, '');
  if (noPunctuation !== question) variations.push(noPunctuation);
  
  const synonyms: Record<string, string[]> = {
    'dash': ['Dash system', 'Dash', 'dashboard', 'parent portal'],
    'map': ['MAP test', 'MAP testing', 'MAP assessment'],
    'homework': ['assignments', 'home work', 'hw']
  };
  
  for (const [word, syns] of Object.entries(synonyms)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(question)) {
      for (const syn of syns) {
        if (syn !== word) {
          const expanded = question.replace(regex, syn);
          if (!variations.includes(expanded)) {
            variations.push(expanded);
          }
        }
      }
    }
  }
  
  return [...new Set(variations)];
}

async function debug() {
  console.log('🔍 DEBUGGING DASH QUERY\n');
  
  const testQuery = 'what is dash';
  
  // 1. Test query variations
  console.log('1️⃣ QUERY VARIATIONS:');
  const variations = generateQueryVariations(testQuery);
  variations.forEach((v, i) => console.log(`   ${i + 1}. "${v}"`));
  
  // 2. Get actual Q&A pairs about Dash
  console.log('\n2️⃣ EXISTING DASH Q&A PAIRS:');
  const { data: dashQAs } = await supabase
    .from('qa_pairs')
    .select('question, answer, audience')
    .ilike('question', '%dash%');
  
  dashQAs?.forEach(qa => {
    console.log(`   Q: "${qa.question}"`);
    console.log(`   Audience: ${qa.audience}\n`);
  });
  
  // 3. Test each variation's similarity
  console.log('3️⃣ TESTING SIMILARITY FOR EACH VARIATION:');
  
  for (const variation of variations) {
    console.log(`\n   Testing: "${variation}"`);
    
    // Generate embedding
    const embedding = await openai.embeddings.create({
      input: variation,
      model: 'text-embedding-3-large',
      dimensions: 1536
    });
    
    // Search for matches
    const { data: matches, error } = await supabase.rpc('search_qa_pairs', {
      query_embedding: embedding.data[0].embedding,
      match_count: 3,
      similarity_threshold: 0.5,
      filter_audience: 'parent'
    });
    
    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else if (matches && matches.length > 0) {
      matches.forEach((m: any) => {
        console.log(`   → ${m.similarity.toFixed(4)} - "${m.question}"`);
      });
    } else {
      console.log(`   → No matches found`);
    }
  }
  
  // 4. Test with the exact Q&A text
  console.log('\n4️⃣ TESTING WITH EXACT Q&A TEXT:');
  const exactQuestion = "What is the Dash system and how do we use it as parents?";
  console.log(`   Query: "${exactQuestion}"`);
  
  const exactEmbedding = await openai.embeddings.create({
    input: exactQuestion,
    model: 'text-embedding-3-large',  
    dimensions: 1536
  });
  
  const { data: exactMatch } = await supabase.rpc('search_qa_pairs', {
    query_embedding: exactEmbedding.data[0].embedding,
    match_count: 1,
    similarity_threshold: 0.5,
    filter_audience: 'parent'
  });
  
  if (exactMatch && exactMatch.length > 0) {
    console.log(`   → Similarity: ${exactMatch[0].similarity.toFixed(4)}`);
    console.log(`   → Should be ~1.0 for exact match`);
  }
  
  // 5. Check if it's an audience filtering issue
  console.log('\n5️⃣ TESTING WITHOUT AUDIENCE FILTER:');
  const { data: noFilter } = await supabase.rpc('search_qa_pairs', {
    query_embedding: embedding.data[0].embedding,
    match_count: 3,
    similarity_threshold: 0.5,
    filter_audience: null
  });
  
  if (noFilter && noFilter.length > 0) {
    console.log('   Found matches without audience filter:');
    noFilter.forEach((m: any) => {
      console.log(`   → ${m.similarity.toFixed(4)} - "${m.question}" (audience: ${m.audience})`);
    });
  }
}

debug().catch(console.error);


