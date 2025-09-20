import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function listQAPairs() {
  console.log('📋 Listing all Q&A pairs in database:\n');
  
  const { data: qaPairs, error } = await supabase
    .from('qa_pairs')
    .select('question, answer, audience, category')
    .order('audience', { ascending: true })
    .order('question', { ascending: true });
  
  if (error) {
    console.error('Error fetching Q&A pairs:', error);
    return;
  }
  
  if (!qaPairs || qaPairs.length === 0) {
    console.log('No Q&A pairs found in database.');
    return;
  }
  
  console.log(`Total Q&A pairs: ${qaPairs.length}\n`);
  
  // Group by audience
  const byAudience = qaPairs.reduce((acc, pair) => {
    if (!acc[pair.audience]) acc[pair.audience] = [];
    acc[pair.audience].push(pair);
    return acc;
  }, {} as Record<string, typeof qaPairs>);
  
  // Display by audience
  for (const [audience, pairs] of Object.entries(byAudience)) {
    console.log(`\n=== ${audience.toUpperCase()} (${pairs.length} pairs) ===\n`);
    
    pairs.forEach((pair, idx) => {
      console.log(`${idx + 1}. Q: ${pair.question}`);
      console.log(`   A: ${pair.answer.substring(0, 100)}${pair.answer.length > 100 ? '...' : ''}`);
      console.log(`   Category: ${pair.category}\n`);
    });
  }
}

listQAPairs().catch(console.error);








