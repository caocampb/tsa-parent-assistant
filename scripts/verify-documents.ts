import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function verifyDocuments() {
  console.log('🔍 Verifying Document Storage System\n');

  // Check all three document tables
  const audiences = ['parent', 'coach', 'shared'] as const;
  
  for (const audience of audiences) {
    console.log(`\n📁 Checking ${audience.toUpperCase()} documents:`);
    console.log('=' .repeat(50));
    
    // Get documents
    const { data: docs, error: docError } = await supabase
      .from(`documents_${audience}`)
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(5);
    
    if (docError) {
      console.error(`❌ Error fetching ${audience} documents:`, docError);
      continue;
    }
    
    if (!docs || docs.length === 0) {
      console.log(`  No documents found`);
      continue;
    }
    
    console.log(`  Found ${docs.length} document(s):`);
    
    for (const doc of docs) {
      console.log(`\n  📄 ${doc.filename}`);
      console.log(`     ID: ${doc.id}`);
      console.log(`     Type: ${doc.doc_type}`);
      console.log(`     Uploaded: ${new Date(doc.uploaded_at).toLocaleString()}`);
      
      // Check chunks for this document
      const { data: chunks, error: chunkError } = await supabase
        .from(`document_chunks_${audience}`)
        .select('id, chunk_index, content, embedding')
        .eq('document_id', doc.id)
        .order('chunk_index')
        .limit(3);
      
      if (chunkError) {
        console.error(`     ❌ Error fetching chunks:`, chunkError);
        continue;
      }
      
      if (!chunks || chunks.length === 0) {
        console.log(`     ⚠️  No chunks found!`);
        continue;
      }
      
      console.log(`     ✅ ${chunks.length} chunk(s) found`);
      
      // Verify first chunk's embedding
      const firstChunk = chunks[0];
      if (firstChunk.embedding) {
        // Check if it's stored as a vector
        const { data: embedCheck } = await supabase
          .from(`document_chunks_${audience}`)
          .select('pg_typeof(embedding) as type, array_length(embedding::real[], 1) as length')
          .eq('id', firstChunk.id)
          .single();
        
        if (embedCheck) {
          const isVector = embedCheck.type === 'vector' || embedCheck.type?.includes('double');
          const dimensions = embedCheck.length;
          
          if (isVector && dimensions === 1536) {
            console.log(`     ✅ Embedding: Valid vector with 1536 dimensions`);
          } else {
            console.log(`     ❌ Embedding: Type=${embedCheck.type}, Dimensions=${dimensions}`);
          }
        }
      } else {
        console.log(`     ⚠️  No embedding found for chunk`);
      }
      
      // Show sample content
      console.log(`     Sample content: "${firstChunk.content.substring(0, 100)}..."`);
    }
  }
  
  // Check Q&A pairs too
  console.log(`\n\n❓ Checking Q&A Pairs:`);
  console.log('=' .repeat(50));
  
  const { data: qaPairs, error: qaError } = await supabase
    .from('qa_pairs')
    .select('audience, count', { count: 'exact' })
    .limit(0); // Just get count
  
  if (!qaError) {
    const { count } = await supabase
      .from('qa_pairs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`  Total Q&A pairs: ${count}`);
    
    // Count by audience
    for (const audience of ['parent', 'coach', 'both']) {
      const { count: audienceCount } = await supabase
        .from('qa_pairs')
        .select('*', { count: 'exact', head: true })
        .eq('audience', audience);
      
      console.log(`  ${audience}: ${audienceCount} pairs`);
    }
  }
  
  console.log('\n✅ Verification complete!');
}

// Run verification
verifyDocuments().catch(console.error);
