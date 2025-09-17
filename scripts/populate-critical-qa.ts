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

// Critical Q&A pairs based on test failures
const criticalQAPairs = [
  // Parent questions
  {
    question: "Do you take credit cards or just checks?",
    answer: "We accept credit cards, debit cards, and ACH bank transfers through our online payment portal. Cash and checks are also accepted at the front office. Autopay is available for monthly tuition with a credit/debit card or bank account.",
    audience: "parent",
    category: "tuition_payments"
  },
  {
    question: "Tell me about your insurance requirements",
    answer: "All enrolled children must have the $50/year TSA insurance fee paid at registration. This covers your child during all TSA activities. Your family's health insurance remains primary; TSA insurance is secondary coverage for sports-related injuries.",
    audience: "parent",
    category: "logistics"
  },
  {
    question: "What's TSA?",
    answer: "Texas Sports Academy combines academics and athletics for ages 5-12. Students receive core education in the morning and sports training in the afternoon, developing both mind and body in a structured environment.",
    audience: "parent",
    category: "general_sales"
  },
  {
    question: "Tell me about TSA",
    answer: "Texas Sports Academy is a unique program combining morning academics with afternoon sports training for children ages 5-12. We provide certified teachers, professional coaches, and a balanced curriculum that develops the whole child.",
    audience: "parent",
    category: "general_sales"
  },
  // Coach questions missing
  {
    question: "How much does TSA cost to run?",
    answer: "Recommended tuition is $15,000 per student. TSA fee is $4,000 per school (includes software, marketing, accreditation). You keep ~$11,000 per student. With 20 students, that's $220,000 annual revenue after TSA fees.",
    audience: "coach",
    category: "tuition_payments"
  },
  {
    question: "What insurance do I need?",
    answer: "You need Commercial General Liability (CGL) insurance covering school and sports activities, plus professional liability coverage. Great American Insurance is TSA's preferred provider. Also required: property insurance for your facility.",
    audience: "coach",
    category: "school_ops"
  },
  {
    question: "When do I get paid?",
    answer: "Monthly payouts on the 15th for previous month's tuition. After TSA's $367/month per student fee, you receive ~$1,100 per enrolled student. Payments process through Stripe to your bank account within 2-3 business days.",
    audience: "coach",
    category: "tuition_payments"
  },
  {
    question: "What do I need to host this?",
    answer: "Minimum 2,000 sq ft indoor space (600-900 for classroom, rest for activities). Outdoor field/court access. Proper zoning for educational use. Certificate of occupancy. ADA compliant. Parking for 20+ vehicles. Adequate restrooms.",
    audience: "coach",
    category: "real_estate"
  },
  {
    question: "How do I incorporate my school?",
    answer: "Most coaches form an LLC (easiest option). File with your state ($100-500 fee). Get an EIN from IRS (free). Open business bank account. For-profit is simpler than non-profit. Consult local attorney or use LegalZoom.",
    audience: "coach",
    category: "school_ops"
  },
  {
    question: "What's the daily schedule for my school?",
    answer: "Standard schedule: 9:00 AM - 11:30 AM academics, 11:30 AM - 3:30 PM sports. You can adjust based on local needs but must maintain 50/50 academic/athletic split. Before/after care optional add-on revenue.",
    audience: "coach",
    category: "school_ops"
  }
];

async function populateCriticalQA() {
  console.log('🚀 Adding critical Q&A pairs to fix test failures...\n');
  
  let successCount = 0;
  let errorCount = 0;

  for (const pair of criticalQAPairs) {
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
          embedding: embedding.data[0].embedding
        });
      
      if (error) {
        console.error(`❌ Error: ${pair.question} (${pair.audience})\n   ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ Added: ${pair.question} (${pair.audience})`);
        successCount++;
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 20));
    } catch (error: any) {
      console.error(`❌ Failed: ${pair.question}\n   ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Summary: ${successCount} added, ${errorCount} errors`);
}

populateCriticalQA().catch(console.error);


