import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function removeBadQA() {
  console.log('🗑️  Removing incorrect parent insurance Q&A...\n');
  
  const { error } = await supabase
    .from('qa_pairs')
    .delete()
    .eq('question', 'Tell me about your insurance requirements')
    .eq('audience', 'parent');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Removed parent insurance Q&A that should only exist for coaches');
  }
}

removeBadQA().catch(console.error);


