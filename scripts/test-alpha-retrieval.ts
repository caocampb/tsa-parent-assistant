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

// Test queries that parents might actually ask
const testQueries = [
  "My kid has ADHD will this work",
  "how much screen time",
  "what if my child is behind in math",
  "do you have homework",
  "whats MAP testing",
  "can you help with dyslexia"
];

async function testQuery(question: string) {
  console.log(`\n🔍 Testing: "${question}"`);
  
  // Generate embedding
  const embedding = await openai.embeddings.create({
    input: question,
    model: 'text-embedding-3-large',
    dimensions: 1536
  });
  
  // Search Q&A pairs
  const { data, error } = await supabase.rpc('search_qa_pairs', {
    query_embedding: embedding.data[0].embedding,
    match_count: 1,
    similarity_threshold: 0.5,
    filter_audience: 'parent'
  });
  
  if (error) {
    console.log('  ❌ Error:', error.message);
    return;
  }
  
  if (data && data.length > 0) {
    const match = data[0];
    console.log(`  ✅ Match (${(match.similarity * 100).toFixed(1)}%): "${match.question}"`);
    console.log(`  Answer: ${match.answer.substring(0, 150)}...`);
  } else {
    console.log('  ⚠️  No match found above 50% threshold');
  }
}

async function runTests() {
  console.log('🧪 Testing Alpha School Q&A Retrieval...\n');
  console.log('Note: Looking for matches above 50% similarity (0.75 is instant answer threshold)');
  
  for (const query of testQueries) {
    await testQuery(query);
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n✅ Test complete!');
  console.log('\nReminder: Matches above 75% get instant answers, 50-75% might use RAG, below 50% uses RAG or fallback.');
}

runTests().catch(console.error);
