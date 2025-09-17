import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

// Common variations users actually ask
const missingVariations = [
  // Cost variations
  {
    question: "What are my out-of-pocket expenses?",
    answer: "Your out-of-pocket expenses include: Monthly tuition $200 (due 1st of month), one-time registration fee $75, annual insurance $50, competition fees (vary by event), optional private lessons $75/hour. Total first month: $325, then $200/month ongoing.",
    audience: "parent",
    category: "tuition_payments"
  },
  {
    question: "How much will this cost me?",
    answer: "TSA costs $200 per month in tuition. You'll also pay a one-time $75 registration fee and $50/year for insurance. So your first payment is $325, then $200 monthly after that.",
    audience: "parent",
    category: "tuition_payments"
  },
  {
    question: "What's the total cost?",
    answer: "Total annual cost: $2,400 in tuition (12 months × $200), plus $75 registration (first year only), plus $50 annual insurance = $2,525 first year, $2,450 subsequent years. Competition fees and private lessons are additional.",
    audience: "parent",
    category: "tuition_payments"
  },
  
  // Schedule variations
  {
    question: "What time is practice?",
    answer: "Practice times depend on age: Ages 5-8 (Beginner): Monday & Wednesday 4:00-6:00 PM. Ages 9-10 (Intermediate): Tuesday & Thursday 4:00-6:30 PM. Ages 11-12 (Advanced): Monday, Wednesday, Friday 4:00-7:00 PM.",
    audience: "parent",
    category: "logistics"
  },
  {
    question: "What are the hours?",
    answer: "TSA operates Monday-Friday. Morning academics: 9:00 AM - 11:30 AM. Afternoon sports: 11:30 AM - 3:30 PM. After-school practice varies by age group (4:00-7:00 PM range). Saturday Open Gym: 9:00 AM - 12:00 PM.",
    audience: "parent",
    category: "logistics"
  },
  
  // Payment method variations
  {
    question: "How do I pay?",
    answer: "You can pay through our online portal using credit/debit cards or ACH bank transfer. We also accept cash or check at the front office. Set up autopay for convenience - get 5% off with quarterly payments or 10% off paying annually.",
    audience: "parent",
    category: "tuition_payments"
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept: Credit cards (Visa, MC, Amex), Debit cards, ACH bank transfers, Cash, and Checks. Pay online through the parent portal or at the front office. Autopay available with discounts.",
    audience: "parent",
    category: "tuition_payments"
  },
  
  // Common coach variations
  {
    question: "How much can I make?",
    answer: "You'll receive approximately $1,100 per student per month after TSA's fees. With 15 students, that's about $16,500/month or $165,000 over 10 months. Your actual profit depends on your facility and operating costs.",
    audience: "coach",
    category: "tuition_payments"
  },
  {
    question: "What's the profit margin?",
    answer: "From $15,000 annual tuition per student: You keep ~$11,000 after TSA's $4,000 fee. Typical expenses: facility ($3-5k), insurance ($2k), supplies ($1k), leaving $3-5k profit per student. With 15 students, expect $45-75k annual profit.",
    audience: "coach",
    category: "tuition_payments"
  }
];

async function addMissingVariations() {
  console.log('🎯 Adding missing high-impact Q&A variations...\n');
  
  let successCount = 0;
  let errorCount = 0;

  for (const pair of missingVariations) {
    try {
      const embedding = await openai.embeddings.create({
        input: pair.question,
        model: 'text-embedding-3-large',
        dimensions: 1536
      });
      
      const { error } = await supabase
        .from('qa_pairs')
        .insert({
          question: pair.question,
          answer: pair.answer,
          category: pair.category,
          audience: pair.audience,
          embedding: embedding.data[0].embedding
        });
      
      if (error) {
        console.error(`❌ Error: ${pair.question}\n   ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ Added: ${pair.question} (${pair.audience})`);
        successCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 20));
    } catch (error: any) {
      console.error(`❌ Failed: ${pair.question}\n   ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Summary: ${successCount} added, ${errorCount} errors`);
}

addMissingVariations().catch(console.error);


