import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

// Configuration
const CHUNK_SIZE = 250; // tokens
const CHUNK_OVERLAP = 50; // tokens

interface DocumentUpload {
  filename: string;
  audience: 'parent' | 'coach' | 'shared';
  docType: string;
}

const documents: DocumentUpload[] = [
  { filename: 'parent-handbook.txt', audience: 'parent', docType: 'handbook' },
  { filename: 'coach-guide.txt', audience: 'coach', docType: 'business' },
  { filename: 'shared-info.txt', audience: 'shared', docType: 'general' }
];

// Simple token estimation (roughly 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Chunk text with overlap
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  
  let currentChunk: string[] = [];
  let currentTokens = 0;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordTokens = estimateTokens(word);
    
    if (currentTokens + wordTokens > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.join(' '));
      
      // Start new chunk with overlap
      const overlapWords = Math.floor(overlap / 4); // Rough estimate
      currentChunk = currentChunk.slice(-overlapWords);
      currentTokens = estimateTokens(currentChunk.join(' '));
    }
    
    currentChunk.push(word);
    currentTokens += wordTokens;
  }
  
  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  return chunks;
}

async function uploadDocument(doc: DocumentUpload) {
  console.log(`\nProcessing ${doc.filename} for ${doc.audience} audience...`);
  
  // Read file
  const filePath = path.join(process.cwd(), 'content', doc.filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Determine table names based on audience
  const docTable = `documents_${doc.audience}`;
  const chunkTable = `document_chunks_${doc.audience}`;
  
  // Insert document record
  const { data: document, error: docError } = await supabase
    .from(docTable)
    .insert({
      filename: doc.filename,
      doc_type: doc.docType,
      idempotency_key: `${doc.audience}_${doc.filename}_v1`
    })
    .select()
    .single();
  
  if (docError) {
    console.error(`Error inserting document:`, docError);
    return;
  }
  
  console.log(`✓ Created document record: ${document.id}`);
  
  // Chunk the content
  const chunks = chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);
  console.log(`✓ Split into ${chunks.length} chunks`);
  
  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    try {
      // Generate embedding
      const embeddingResponse = await openai.embeddings.create({
        input: chunk,
        model: 'text-embedding-3-large',
        dimensions: 1536
      });
      
      // Insert chunk
      const { error: chunkError } = await supabase
        .from(chunkTable)
        .insert({
          document_id: document.id,
          chunk_index: i,
          content: chunk,
          embedding: embeddingResponse.data[0].embedding
        });
      
      if (chunkError) {
        console.error(`Error inserting chunk ${i}:`, chunkError);
      } else {
        console.log(`✓ Inserted chunk ${i + 1}/${chunks.length}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.error(`Error processing chunk ${i}:`, error);
    }
  }
  
  console.log(`✓ Completed ${doc.filename}`);
}

async function uploadAllDocuments() {
  console.log('Starting document upload...\n');
  
  for (const doc of documents) {
    await uploadDocument(doc);
  }
  
  console.log('\n✅ All documents uploaded successfully!');
}

// Run the upload
uploadAllDocuments().catch(console.error);


