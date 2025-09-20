#!/usr/bin/env bun

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

/**
 * Convert array to PostgreSQL array literal format
 */
function formatPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

// Missing Q&A pairs based on our analysis
const missingQAs = [
  // Dash - casual queries (we only have the formal "What is the Dash system and how do we use it as parents?")
  {
    question: "What is Dash?",
    answer: "Dash is TSA's parent portal where you can see your child's daily progress, including lessons completed and screen recordings of their work. You can log in daily to track their individual progress across every subject.",
    audience: "parent" as const,
    category: "general_sales"
  },
  {
    question: "dash login",
    answer: "To login to Dash, you'll receive credentials when you enroll. Visit the Dash portal at [your school's Dash URL] and use your parent login credentials. Contact your school if you need password help.",
    audience: "parent" as const,
    category: "logistics"
  },
  {
    question: "How do I access Dash?",
    answer: "You can access Dash by logging in with your parent credentials at [your school's Dash URL]. You'll receive login information when you enroll. The portal works on any device with internet access.",
    audience: "parent" as const,
    category: "logistics"
  },
  
  // MAP - simple definition (we have complex MAP questions but not the basic one)
  {
    question: "What is MAP?",
    answer: "MAP (Measures of Academic Progress) is a computer-adaptive test given 3 times a year (fall, winter, spring) that measures your child's academic level and growth. It helps personalize their learning plan.",
    audience: "parent" as const,
    category: "academics"
  },
  {
    question: "What is MAP testing?",
    answer: "MAP testing is a nationally-normed assessment by NWEA that adapts to your child's level as they answer questions. We use it to understand where your child is academically and create their personalized learning path.",
    audience: "parent" as const,
    category: "academics"
  },
  
  // 2 Hour Learning - basic definition
  {
    question: "What is 2 hour learning?",
    answer: "2 Hour Learning is our academic approach where students complete focused, personalized academics in about 2 hours (3 for high school), then spend the rest of the day on sports training and life skills. All learning is AI-driven and self-paced.",
    audience: "parent" as const,
    category: "academics"
  },
  {
    question: "What is two hour learning?",
    answer: "Two Hour Learning is our educational model that concentrates academic work into an efficient 2-hour block using AI-powered personalized learning, freeing up the rest of the day for athletics and life skills development.",
    audience: "parent" as const,
    category: "academics"
  },
  
  // Other casual/action queries
  {
    question: "contact TSA",
    answer: "You can contact TSA at (512) 555-8722 or email info@texassportsacademy.com. Office hours are Monday-Friday, 8:00 AM - 5:00 PM CT.",
    audience: "both" as const,
    category: "logistics"
  },
  {
    question: "TSA phone number",
    answer: "TSA's phone number is (512) 555-8722. Office hours are Monday-Friday, 8:00 AM - 5:00 PM CT.",
    audience: "both" as const,
    category: "logistics"
  },
  {
    question: "get started",
    answer: "To get started with TSA: 1) Schedule a tour or info session, 2) Submit an application, 3) Your child will take the MAP assessment, 4) Once enrolled, you'll receive Dash login credentials to track progress. Contact us at (512) 555-8722 to begin!",
    audience: "both" as const,
    category: "general_sales"
  }
];

async function addMissingQAs() {
  console.log('🚀 Adding missing Q&A pairs...\n');
  
  // First, check which ones already exist
  const { data: existingQAs } = await supabase
    .from('qa_pairs')
    .select('question');
  
  const existingQuestions = new Set(
    existingQAs?.map(qa => qa.question.toLowerCase()) || []
  );
  
  let addedCount = 0;
  let skippedCount = 0;
  
  for (const qa of missingQAs) {
    // Skip if already exists (case-insensitive)
    if (existingQuestions.has(qa.question.toLowerCase())) {
      console.log(`⏭️  Skipping (already exists): "${qa.question}"`);
      skippedCount++;
      continue;
    }
    
    console.log(`\n📝 Adding: "${qa.question}"`);
    console.log(`   Category: ${qa.category}`);
    console.log(`   Audience: ${qa.audience}`);
    
    try {
      // Generate embedding
      const embeddingResponse = await openai.embeddings.create({
        input: qa.question,
        model: 'text-embedding-3-large',
        dimensions: 1536
      });
      
      // Insert Q&A pair
      const { error } = await supabase
        .from('qa_pairs')
        .insert({
          question: qa.question,
          answer: qa.answer,
          category: qa.category,
          audience: qa.audience,
          embedding: formatPgVector(embeddingResponse.data[0].embedding) as any
        });
      
      if (error) {
        console.error(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Added successfully`);
        addedCount++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   ✅ Added: ${addedCount} Q&A pairs`);
  console.log(`   ⏭️  Skipped: ${skippedCount} (already existed)`);
  console.log(`   📝 Total in script: ${missingQAs.length}`);
}

// Run the script
addMissingQAs().catch(console.error);


