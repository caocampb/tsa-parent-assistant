import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function testInsert() {
  console.log('Testing direct database insert...\n');

  // Test inserting into documents_parent
  const testDoc = {
    filename: 'test-direct-insert.txt',
    doc_type: 'handbook',
    idempotency_key: `test-${Date.now()}`
  };

  console.log('Attempting to insert:', testDoc);

  const { data, error } = await supabase
    .from('documents_parent')
    .insert(testDoc)
    .select()
    .single();

  if (error) {
    console.error('❌ Insert failed:', error);
    console.error('Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
  } else {
    console.log('✅ Insert successful!');
    console.log('Document created:', data);
    
    // Clean up test document
    const { error: deleteError } = await supabase
      .from('documents_parent')
      .delete()
      .eq('id', data.id);
    
    if (deleteError) {
      console.error('Failed to clean up test document:', deleteError);
    } else {
      console.log('Test document cleaned up');
    }
  }
}

testInsert().catch(console.error);
