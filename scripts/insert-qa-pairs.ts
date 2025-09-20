import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import qaPairs from '../qa_pairs_extraction.json';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\nMissing SUPABASE_SERVICE_ROLE_KEY!');
  console.error('Add to .env.local:');
  console.error('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here\n');
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

/**
 * Convert array to PostgreSQL array literal format
 * This prevents Supabase from stringifying the embedding
 */
function formatPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

async function insertQAPairs() {
  console.log(`Inserting ${qaPairs.qa_pairs.length} Q&A pairs...`);
  
  for (const pair of qaPairs.qa_pairs) {
    try {
      // Generate embedding for the question
      const embedding = await openai.embeddings.create({
        input: pair.question,
        model: 'text-embedding-3-large',
        dimensions: 1536
      });
      
      // Insert Q&A pair with embedding
      const { error } = await supabase
        .from('qa_pairs')
        .insert({
          question: pair.question,
          answer: pair.answer,
          category: pair.category,
          audience: pair.audience,
          embedding: formatPgVector(embedding.data[0].embedding) as any
        });
      
      if (error) {
        console.error(`Error inserting: ${pair.question}`, error);
      } else {
        console.log(`✓ Inserted: ${pair.question.substring(0, 50)}...`);
      }
      
      // Rate limit: OpenAI allows 3000 RPM for embeddings
      await new Promise(resolve => setTimeout(resolve, 20));
    } catch (error) {
      console.error(`Failed to process: ${pair.question}`, error);
    }
  }
  
  console.log('Done!');
}

// Run the script
insertQAPairs().catch(console.error);
