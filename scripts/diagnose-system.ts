import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
  console.log('🔍 SYSTEM DIAGNOSIS\n');

  // 1. Check Q&A Data
  console.log('1️⃣ Q&A PAIRS DATA CHECK:');
  const { data: qaCount } = await supabase
    .from('qa_pairs')
    .select('audience', { count: 'exact', head: true });
  
  const { data: qaSample } = await supabase
    .from('qa_pairs')
    .select('question, audience')
    .limit(5);
  
  console.log(`Total Q&A pairs: ${qaCount?.length || 0}`);
  console.log('Sample Q&A pairs:', qaSample);

  // 2. Check specific failing queries
  console.log('\n2️⃣ SPECIFIC QUERY TESTS:');
  const testQueries = [
    { q: 'Tell me all the costs and fees', audience: 'parent' },
    { q: 'What insurance do I need?', audience: 'coach' },
    { q: 'When do I get paid?', audience: 'coach' }
  ];

  for (const test of testQueries) {
    const { data } = await supabase
      .from('qa_pairs')
      .select('question, answer')
      .textSearch('question', test.q)
      .eq('audience', test.audience)
      .limit(1);
    
    console.log(`\n"${test.q}" (${test.audience}):`);
    console.log(data?.length ? '✅ Found in Q&A' : '❌ NOT in Q&A pairs');
  }

  // 3. Check document tables
  console.log('\n3️⃣ DOCUMENT TABLES CHECK:');
  const tables = ['documents_parent', 'documents_coach', 'documents_shared'];
  
  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    console.log(`${table}: ${count || 0} chunks`);
  }

  // 4. Test embedding similarity
  console.log('\n4️⃣ ALGORITHM CHECK (Testing Q&A matching):');
  console.log('If Q&A pairs exist but show qaPairsFound: 0, it\'s an ALGO fail');
  console.log('If Q&A pairs don\'t exist, it\'s a DATA fail');
}

diagnose().catch(console.error);


