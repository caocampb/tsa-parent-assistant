import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Realistic questions based on Alpha Dean Q&A content
const testQuestions = [
  // Parent questions - Special Needs
  { question: "My son has ADHD and struggles in traditional school. Will your program work for him?", audience: "parent" },
  { question: "Do you accept kids with IEPs", audience: "parent" },
  { question: "my daughter is dyslexic can she succeed here", audience: "parent" },
  { question: "What's the difference between accommodations and modifications at your school?", audience: "parent" },
  
  // Parent questions - Academic Concerns
  { question: "My 7th grader tested at 3rd grade reading level, how fast can you help?", audience: "parent" },
  { question: "Why does MAP testing take so many days??", audience: "parent" },
  { question: "How do you personalize learning for each kid", audience: "parent" },
  { question: "what happens if my kid doesnt finish their work at school", audience: "parent" },
  
  // Parent questions - Screen Time & Activities
  { question: "how many hours will my kid stare at a computer", audience: "parent" },
  { question: "What do kids do in the afternoon that's not on screens?", audience: "parent" },
  { question: "is this just online school in a building", audience: "parent" },
  
  // Parent questions - Practical
  { question: "Will there be homework every night?", audience: "parent" },
  { question: "How can I help my child at home without doing the work for them?", audience: "parent" },
  { question: "whats the dash system", audience: "parent" },
  { question: "Do you have prom and football games?", audience: "parent" },
  
  // Coach questions - Business
  { question: "How much can I realistically make with 20 students?", audience: "coach" },
  { question: "What insurance do I need for my TSA location?", audience: "coach" },
  { question: "Can I reduce tuition for families who can't afford $15k?", audience: "coach" },
  
  // Edge cases and tricky questions
  { question: "my child needs ABA therapy can you help", audience: "parent" },
  { question: "Is 2 hour learning good for gifted kids or just struggling ones?", audience: "parent" },
  { question: "What specific entrepreneurship skills do you teach?", audience: "parent" },
  { question: "Can my kid transfer credits if we move to California?", audience: "parent" },
  
  // Natural variations
  { question: "screen time????", audience: "parent" },
  { question: "homework policy", audience: "parent" },
  { question: "how much", audience: "parent" },
];

async function testQuestion(q: { question: string, audience: string }) {
  console.log(`\n🔍 Testing: "${q.question}" (${q.audience})`);
  
  try {
    const response = await fetch('http://localhost:3000/api/q', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: q.question,
        audience: q.audience
      })
    });
    
    if (!response.ok) {
      console.log(`  ❌ HTTP Error: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    
    // Show results
    console.log(`  ✅ Confidence: ${(data.confidence * 100).toFixed(1)}%`);
    
    // Show answer preview
    const answerPreview = data.answer.substring(0, 150).replace(/\n/g, ' ');
    console.log(`  Answer: "${answerPreview}..."`);
    
    // Show source type
    if (data.sources && data.sources.length > 0) {
      const sourceType = data.sources[0].chunk_id ? 'Document chunk' : 'Q&A pair';
      console.log(`  Source: ${sourceType}`);
    }
    
    // Flag potential issues
    if (data.confidence < 0.3) {
      console.log(`  ⚠️  LOW CONFIDENCE - Might return fallback`);
    } else if (data.confidence < 0.75) {
      console.log(`  📄 Used RAG (not direct Q&A match)`);
    } else {
      console.log(`  ⚡ Direct Q&A match!`);
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error}`);
  }
}

async function runTests() {
  console.log('🧪 Testing Q API with Alpha School Questions\n');
  console.log('Starting Next.js server if not already running...');
  console.log('Make sure "bun dev" is running in another terminal!\n');
  
  // Wait a moment for any server startup
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log(`Testing ${testQuestions.length} questions...\n`);
  console.log('Confidence levels:');
  console.log('  75%+ = Direct Q&A match (fast)');
  console.log('  30-75% = RAG generated answer');
  console.log('  <30% = Fallback message\n');
  console.log('═'.repeat(60));
  
  for (const question of testQuestions) {
    await testQuestion(question);
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n═'.repeat(60));
  console.log('\n✅ Test complete!');
  
  // Summary
  console.log('\nKey Insights:');
  console.log('- Special needs questions should have good Q&A coverage');
  console.log('- Screen time and homework are well covered');
  console.log('- Coach business questions use different knowledge base');
  console.log('- Natural language variations should still match');
}

runTests().catch(console.error);


