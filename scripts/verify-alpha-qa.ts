import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAlphaContent() {
  console.log('🔍 Verifying Alpha School Q&A Integration...\n');
  
  // 1. Check total counts
  const { count: totalCount } = await supabase
    .from('qa_pairs')
    .select('*', { count: 'exact', head: true });
    
  console.log(`✓ Total Q&A pairs: ${totalCount}`);
  
  // 2. Check for specific Alpha content
  const alphaKeywords = [
    'ADHD',
    'MAP testing', 
    'screen time',
    'Dash system',
    'two hour learning',
    'special needs',
    'homework'
  ];
  
  console.log('\n📋 Checking for Alpha-specific content:');
  
  for (const keyword of alphaKeywords) {
    const { data, count } = await supabase
      .from('qa_pairs')
      .select('question', { count: 'exact' })
      .ilike('question', `%${keyword}%`);
      
    console.log(`  ${keyword}: ${count} Q&As`);
    if (data && data.length > 0) {
      console.log(`    Example: "${data[0].question}"`);
    }
  }
  
  // 3. Check audience distribution
  const { data: audienceCounts } = await supabase
    .from('qa_pairs')
    .select('audience')
    .order('audience');
    
  const counts = audienceCounts?.reduce((acc, row) => {
    acc[row.audience] = (acc[row.audience] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n👥 Audience Distribution:');
  Object.entries(counts || {}).forEach(([audience, count]) => {
    console.log(`  ${audience}: ${count}`);
  });
  
  // 4. Sample a few Alpha Q&As
  const { data: samples } = await supabase
    .from('qa_pairs')
    .select('question, answer')
    .or('question.ilike.%MAP%,question.ilike.%screen%,question.ilike.%ADHD%')
    .limit(3);
    
  console.log('\n🎯 Sample Alpha Q&As:');
  samples?.forEach((qa, i) => {
    console.log(`\n${i + 1}. Q: ${qa.question}`);
    console.log(`   A: ${qa.answer.substring(0, 100)}...`);
  });
}

verifyAlphaContent().catch(console.error);
