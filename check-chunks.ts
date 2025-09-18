#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

async function checkChunks() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check parent chunks
  const { data: parentChunks, error: parentError } = await supabase
    .from('document_chunks_parent')
    .select('id, content, chunk_index')
    .limit(5);

  if (parentError) {
    console.log('Error fetching parent chunks:', parentError);
  } else {
    console.log('Parent chunks found:', parentChunks?.length || 0);
    
    if (parentChunks && parentChunks.length > 0) {
      console.log('\nFirst parent chunk:');
      console.log('Content preview:', parentChunks[0].content.substring(0, 200) + '...');
      console.log('Chunk index:', parentChunks[0].chunk_index);
    }
  }

  // Count total parent chunks
  const { count: parentCount } = await supabase
    .from('document_chunks_parent')
    .select('*', { count: 'exact', head: true });
  
  console.log('\nTotal parent chunks in database:', parentCount);

  // Check shared chunks
  const { data: sharedChunks, error: sharedError } = await supabase
    .from('document_chunks_shared')
    .select('id, content')
    .limit(5);

  if (sharedError) {
    console.log('\nError fetching shared chunks:', sharedError);
  } else {
    console.log('\nShared chunks found:', sharedChunks?.length || 0);
  }

  // Check parent documents
  const { data: parentDocs } = await supabase
    .from('documents_parent')
    .select('filename, uploaded_at');
  
  console.log('\nParent documents:', parentDocs?.length || 0);
  if (parentDocs && parentDocs.length > 0) {
    parentDocs.forEach(doc => {
      console.log(`  - ${doc.filename} (uploaded: ${doc.uploaded_at})`);
    });
  }
}

checkChunks().catch(console.error);
