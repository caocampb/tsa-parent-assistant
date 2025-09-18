// Test with realistic parent queries based on actual content

const realParentQueries = [
  // Registration questions
  "When does spring registration open?",
  "How do I register my child for TSA?", 
  "What documents do I need for registration?",
  "Is there an early bird discount for spring registration?",
  "Do I need a physical exam for my kid?",
  
  // Fee and payment questions
  "How much is it per month?",
  "When is tuition due each month?",
  "What happens if I pay late?",
  "Do you offer payment plans?",
  "Is there a discount for paying annually?",
  "How much is the registration fee?",
  "What's the total cost to get started?",
  
  // Schedule questions  
  "What time does my 6 year old practice?",
  "When do the 5-8 year olds practice?",
  "My son is 10, what days does he practice?",
  "Is there practice on Saturdays?",
  "Are you open during spring break?",
  "Do you follow AISD holidays?",
  
  // Uniform and equipment
  "Where do I buy the uniform?",
  "How much does the uniform cost?",
  "Can I order uniforms online?",
  "What does my child need to wear to practice?",
  
  // Policies and procedures
  "How early can I drop off my child?",
  "What if I'm late picking up?",
  "What's your makeup policy?",
  "Can my child make up a missed class?",
  "How do I notify about an absence?",
  "Do you offer sibling discounts?",
  
  // Safety and medical
  "Are the coaches certified in CPR?",
  "What happens in a medical emergency?",
  "Does my child need insurance?",
  
  // Academic program
  "What are the school hours?",
  "When do they do academics vs sports?",
  "How can I track my child's academic progress?",
  "Is the education accredited?",
  
  // Contact and general
  "What's the address of the facility?",
  "What's your phone number?",
  "What are your office hours?",
  "Who do I contact with questions?",
  "Can I get private lessons for my kid?",
  
  // Mixed intent queries
  "My daughter is 7 and I want to know about fees and schedule",
  "Tell me everything about registering for spring",
  "I need info about your beginner program",
  "What do I need to know before signing up?"
];

interface TestResult {
  query: string;
  hasAnswer: boolean;
  mentionsKey: string[];
  responseTime: number;
  confidence?: number;
}

async function testQueries() {
  console.log('🧪 Testing Real Parent Queries\n');
  console.log(`Running ${realParentQueries.length} realistic parent queries...\n`);
  
  // Wait for server
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const results: TestResult[] = [];
  let successCount = 0;
  
  for (let i = 0; i < realParentQueries.length; i++) {
    const query = realParentQueries[i];
    process.stdout.write(`[${i + 1}/${realParentQueries.length}] "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}" `);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch('http://localhost:3000/api/q', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, audience: 'parent' }),
      });
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      const hasAnswer = data.answer && !data.answer.includes('contact TSA at');
      
      // Check for key information in the answer
      const keyChecks = [];
      if (query.toLowerCase().includes('spring') && data.answer?.includes('January')) keyChecks.push('spring date');
      if (query.toLowerCase().includes('month') && data.answer?.includes('200')) keyChecks.push('$200');
      if (query.toLowerCase().includes('practice') && data.answer?.match(/\d:\d\d/)) keyChecks.push('time');
      if (query.toLowerCase().includes('uniform') && data.answer?.includes('45')) keyChecks.push('$45');
      if (query.toLowerCase().includes('address') && data.answer?.includes('1500')) keyChecks.push('address');
      
      results.push({
        query,
        hasAnswer,
        mentionsKey: keyChecks,
        responseTime,
        confidence: data.confidence
      });
      
      if (hasAnswer) {
        successCount++;
        console.log('✅');
      } else {
        console.log('❌');
      }
      
    } catch (error) {
      console.log('💥');
      results.push({
        query,
        hasAnswer: false,
        mentionsKey: [],
        responseTime: 0
      });
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`✅ Successful: ${successCount}/${realParentQueries.length} (${Math.round(successCount/realParentQueries.length*100)}%)`);
  console.log(`❌ Failed: ${realParentQueries.length - successCount}/${realParentQueries.length} (${Math.round((realParentQueries.length - successCount)/realParentQueries.length*100)}%)`);
  console.log(`⏱️  Avg response time: ${Math.round(results.reduce((a,b) => a + b.responseTime, 0) / results.length)}ms`);
  
  // Show failures
  const failures = results.filter(r => !r.hasAnswer);
  if (failures.length > 0) {
    console.log('\n❌ Failed Queries:');
    failures.forEach(f => {
      console.log(`- "${f.query}"`);
    });
  }
  
  // Show slow queries
  const slowQueries = results.filter(r => r.responseTime > 5000);
  if (slowQueries.length > 0) {
    console.log('\n🐌 Slow Queries (>5s):');
    slowQueries.forEach(s => {
      console.log(`- "${s.query}" (${(s.responseTime/1000).toFixed(1)}s)`);
    });
  }
  
  // Category breakdown
  console.log('\n📑 Category Performance:');
  const categories = {
    registration: results.filter(r => r.query.toLowerCase().includes('regist')),
    fees: results.filter(r => r.query.match(/fee|cost|price|month|pay|tuition/i)),
    schedule: results.filter(r => r.query.match(/time|practice|schedule|when.*practice|hour/i)),
    academic: results.filter(r => r.query.match(/school|academic|education|learn/i)),
    safety: results.filter(r => r.query.match(/safe|medical|emergency|cpr|insurance/i))
  };
  
  Object.entries(categories).forEach(([cat, queries]) => {
    const success = queries.filter(q => q.hasAnswer).length;
    console.log(`${cat}: ${success}/${queries.length} (${Math.round(success/queries.length*100)}%)`);
  });
}

testQueries().catch(console.error);



