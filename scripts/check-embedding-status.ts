import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkEmbeddings() {
  // Get the alpha document
  const { data: doc } = await supabase
    .from('documents_parent')
    .select('id')
    .eq('filename', 'alpha-dean-qa.txt')
    .single();
    
  if (!doc) {
    console.log('No document found');
    return;
  }
  
  // Check first chunk in detail
  const { data: chunk } = await supabase
    .from('document_chunks_parent')
    .select('*')
    .eq('document_id', doc.id)
    .eq('chunk_index', 0)
    .single();
    
  console.log('First chunk details:');
  console.log('- Has embedding:', !!chunk?.embedding);
  console.log('- Embedding type:', typeof chunk?.embedding);
  console.log('- Is array:', Array.isArray(chunk?.embedding));
  console.log('- First few values:', chunk?.embedding?.slice(0, 5));
  
  // Try a vector search to see if embeddings work
  console.log('\n🧪 Testing vector search...');
  
  const testEmbedding = new Array(1536).fill(0.1); // dummy embedding
  
  const { data: searchResults, error } = await supabase.rpc('search_documents_parent', {
    query_embedding: testEmbedding,
    match_count: 3,
    similarity_threshold: 0.1
  });
  
  if (error) {
    console.log('Search error:', error);
  } else {
    console.log(`Found ${searchResults?.length || 0} results`);
    searchResults?.forEach(r => {
      console.log(`- Similarity: ${r.similarity.toFixed(3)}, Content: "${r.content.substring(0, 50)}..."`);
    });
  }
}

checkEmbeddings().catch(console.error);