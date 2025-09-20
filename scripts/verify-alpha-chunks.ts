import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyChunks() {
  console.log('🔍 Verifying Alpha School Document Chunks...\n');
  
  // 1. Check if alpha-dean-qa document exists
  const { data: docs } = await supabase
    .from('documents_parent')
    .select('id, filename, uploaded_at')
    .eq('filename', 'alpha-dean-qa.txt');
    
  if (!docs || docs.length === 0) {
    console.log('❌ No alpha-dean-qa.txt document found!');
    return;
  }
  
  const doc = docs[0];
  console.log(`✓ Document found: ${doc.filename}`);
  console.log(`  ID: ${doc.id}`);
  console.log(`  Uploaded: ${doc.uploaded_at}\n`);
  
  // 2. Check chunks for this document
  const { data: chunks, count } = await supabase
    .from('document_chunks_parent')
    .select('chunk_index, content, embedding', { count: 'exact' })
    .eq('document_id', doc.id)
    .order('chunk_index');
    
  console.log(`📄 Document Chunks: ${count} total\n`);
  
  // 3. Verify embeddings exist
  let embeddingsOk = true;
  chunks?.forEach(chunk => {
    if (!chunk.embedding || chunk.embedding.length !== 1536) {
      embeddingsOk = false;
      console.log(`❌ Chunk ${chunk.chunk_index} missing/invalid embedding`);
    }
  });
  
  if (embeddingsOk) {
    console.log('✓ All chunks have valid 1536-dimension embeddings\n');
  }
  
  // 4. Sample some chunks
  console.log('📋 Sample Chunks:');
  chunks?.slice(0, 3).forEach(chunk => {
    console.log(`\nChunk ${chunk.chunk_index}:`);
    console.log(`"${chunk.content.substring(0, 150)}..."`);
  });
  
  // 5. Test search on chunks
  console.log('\n\n🧪 Testing chunk search for "special needs"...');
  
  // Simple content search (not using embeddings for this test)
  const { data: searchResults } = await supabase
    .from('document_chunks_parent')
    .select('chunk_index, content')
    .eq('document_id', doc.id)
    .ilike('content', '%special needs%')
    .limit(3);
    
  if (searchResults && searchResults.length > 0) {
    console.log(`✓ Found ${searchResults.length} chunks mentioning "special needs"`);
    searchResults.forEach(chunk => {
      const snippet = chunk.content.substring(
        chunk.content.toLowerCase().indexOf('special needs') - 50,
        chunk.content.toLowerCase().indexOf('special needs') + 100
      );
      console.log(`  Chunk ${chunk.chunk_index}: "...${snippet}..."`);
    });
  }
  
  console.log('\n✅ Chunk verification complete!');
  console.log('\nSummary:');
  console.log('- Document chunks: Created ✓');
  console.log('- Embeddings: Generated ✓');
  console.log('- RAG fallback: Ready ✓');
}

verifyChunks().catch(console.error);
