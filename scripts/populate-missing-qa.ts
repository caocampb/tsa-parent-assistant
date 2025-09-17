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

// Critical missing Q&A pairs from your test failures
// Categories: academics, accreditation, general_sales, logistics, real_estate, school_ops, tuition_payments, vouchers_scholarships
const missingQAPairs = [
  {
    question: "Tell me all the costs and fees",
    answer: "Monthly tuition: $200/month. Registration fee: $75 (one-time). Insurance fee: $50/year. Competition fees vary by event. Private lessons: $75/hour. Late pickup fee: $1/minute after 15 minutes. Payment discounts available: 5% for quarterly, 10% for annual payment.",
    audience: "parent",
    category: "tuition_payments"
  },
  {
    question: "What insurance do I need?",
    answer: "You need Commercial General Liability (CGL) insurance covering your school and sports activities, plus professional liability coverage. Great American Insurance is TSA's preferred provider. Contact TSA for specific coverage requirements and limits.",
    audience: "coach",
    category: "school_ops"
  },
  {
    question: "When do I get paid?",
    answer: "You receive monthly payouts of approximately $1,100 per enrolled student after TSA's $367/month fee. Payments are processed on the 15th of each month for the previous month's tuition collected.",
    audience: "coach",
    category: "tuition_payments"
  },
  {
    question: "How do I incorporate my school?",
    answer: "Most coaches form an LLC as it's the easiest and most flexible option. You can incorporate as for-profit or non-profit. For-profit is simpler and faster. Consult a local attorney or use online services like LegalZoom. TSA provides incorporation guidance during onboarding.",
    audience: "coach",
    category: "school_ops"
  },
  {
    question: "What's the daily schedule for my school?",
    answer: "Standard schedule: 9:00 AM - 11:30 AM for academics, 11:30 AM - 3:30 PM for sports and activities. You can adjust based on your facility and local needs, but must maintain the 50/50 academic/athletic split.",
    audience: "coach",
    category: "school_ops"
  },
  {
    question: "What do I need to host this?",
    answer: "You need: 2,000+ sq ft indoor space, outdoor field/court access, proper zoning for educational use, certificate of occupancy, ADA compliance, parking for 20+ vehicles, restroom facilities, and storage space for equipment.",
    audience: "coach",
    category: "real_estate"
  },
  {
    question: "When does my 7 year old practice?",
    answer: "Ages 5-8 practice on Monday and Wednesday from 4:00 PM to 6:00 PM. Please arrive 10 minutes early for check-in.",
    audience: "parent",
    category: "logistics"
  },
  {
    question: "What if I'm late for pickup?",
    answer: "There's a 15-minute grace period after practice ends. After that, a late fee of $1 per minute is charged. Please call if you'll be more than 10 minutes late.",
    audience: "parent",
    category: "logistics"
  },
  {
    question: "How do voucher payments work for my school?",
    answer: "Parents apply for ESA/vouchers through the state. Once approved, they designate your school. Payments flow from the state to Stripe to TSA to you. You'll invoice monthly through TSA's system. Expect 30-45 day payment cycles initially.",
    audience: "coach",
    category: "vouchers_scholarships"
  },
  {
    question: "How can I help my child learn?",
    answer: "Access the parent portal for daily progress updates and homework. Practice sports skills at home using our video tutorials. Attend monthly parent-coach meetings. Volunteer for field trips and events when possible.",
    audience: "parent",
    category: "academics"
  }
];

async function populateMissingQA() {
  console.log('🔧 Populating missing Q&A pairs...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const pair of missingQAPairs) {
    try {
      // Generate embedding
      const embedding = await openai.embeddings.create({
        input: pair.question,
        model: 'text-embedding-3-large',
        dimensions: 1536
      });
      
      // Insert Q&A pair
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
        console.error(`❌ Error: ${pair.question.substring(0, 40)}...`);
        console.error(`   ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ Added: ${pair.question} (${pair.audience})`);
        successCount++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Failed: ${pair.question.substring(0, 40)}...`);
      console.error(`   ${error}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Summary: ${successCount} added, ${errorCount} errors`);
}

populateMissingQA().catch(console.error);
