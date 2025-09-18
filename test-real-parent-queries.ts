#!/usr/bin/env node

import { config } from 'dotenv';
config({ path: '.env.local' });

interface TestResult {
  query: string;
  matched: boolean;
  similarity?: number;
  ragFallback: boolean;
  responseTime: number;
}

const results: TestResult[] = [];

// Real parent queries - how they actually text/type
const realParentQueries = [
  // Cost questions - how parents really ask
  "how much",
  "cost?", 
  "price",
  "whats the monthly",
  "monthly fee",
  "how much per month",
  "$ per month?",
  "fees",
  "what do i pay",
  "payment amount",
  
  // Schedule questions - practical parent concerns
  "when is practice",
  "practice times",
  "schedule",
  "what days",
  "my daughter is 8 when does she go",
  "6 year old schedule",
  "practice schedule for 7yo",
  "when do they practice",
  "times?",
  
  // Sign up questions - decision making mode
  "how do i sign up",
  "registration",
  "how to join",
  "sign my son up",
  "enroll my daughter", 
  "get started",
  "join TSA",
  
  // Location questions - logistics
  "where is practice",
  "location",
  "address",
  "where do we go",
  "practice location",
  
  // Equipment/preparation - getting ready
  "what do they need",
  "equipment needed",
  "what to bring",
  "uniform?",
  "cleats required?",
  
  // Mixed/conversational - how parents really text
  "hi can you tell me about TSA",
  "my neighbor mentioned this whats the cost and schedule",
  "thinking about signing up my 7yo need info",
  "is this good for beginners",
  "my kid has never played before",
  
  // Specific situation questions
  "missed payment what happens",
  "can we do month to month",
  "sibling discount?",
  "financial aid available",
  "makeup classes?",
  "what if we miss practice",
  
  // Comparison shopping
  "why choose TSA",
  "vs other programs", 
  "worth it?",
  "benefits",
  
  // Age-specific (very common)
  "too young?",
  "5 year old too young",
  "age groups",
  "my twins are different ages",
  
  // Commitment concerns
  "how long is the season",
  "year round?",
  "can we try it out",
  "trial period",
  "commitment required"
];

async function testQuery(query: string): Promise<void> {
  console.log(`\nTesting: "${query}"`);
  
  try {
    const response = await fetch('http://localhost:3000/api/q', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query, audience: 'parent' })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let debugInfo: any = null;
    let fullResponse = '';
    const startTime = Date.now();

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      fullResponse += chunk;
      
      // Look for debug info in the stream
      const debugMatch = chunk.match(/Q&A Search Debug: ({[\s\S]*?})\n/);
      if (debugMatch) {
        try {
          debugInfo = JSON.parse(debugMatch[1]);
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    const responseTime = Date.now() - startTime;

    if (debugInfo) {
      const matched = debugInfo.willUseQA === true;
      results.push({
        query,
        matched,
        similarity: debugInfo.bestQAMatch?.similarity,
        ragFallback: debugInfo.ragFallback,
        responseTime
      });

      console.log(`  → ${matched ? '✅ Q&A Match' : '❌ RAG Fallback'}`);
      if (debugInfo.bestQAMatch) {
        console.log(`  → Matched: "${debugInfo.bestQAMatch.question}" (${(debugInfo.bestQAMatch.similarity * 100).toFixed(1)}%)`);
      }
    }
  } catch (error) {
    console.error(`  → Error: ${error.message}`);
  }
}

async function runTests() {
  console.log('🧪 Testing Real Parent Queries...\n');
  console.log('This simulates how actual parents text/type their questions.');
  console.log('================================================\n');

  // Test in smaller batches to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < realParentQueries.length; i += batchSize) {
    const batch = realParentQueries.slice(i, i + batchSize);
    await Promise.all(batch.map(query => testQuery(query)));
    
    // Small delay between batches
    if (i + batchSize < realParentQueries.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log('\n\n📊 SUMMARY');
  console.log('==========\n');

  const matched = results.filter(r => r.matched);
  const fallbacks = results.filter(r => r.ragFallback);

  console.log(`Total queries tested: ${results.length}`);
  console.log(`Q&A matches: ${matched.length} (${(matched.length / results.length * 100).toFixed(1)}%)`);
  console.log(`RAG fallbacks: ${fallbacks.length} (${(fallbacks.length / results.length * 100).toFixed(1)}%)`);

  // Group fallbacks by topic
  console.log('\n\n🔍 COMMON PATTERNS IN FAILED QUERIES:');
  console.log('=====================================\n');

  const costFallbacks = fallbacks.filter(r => 
    r.query.match(/cost|price|fee|pay|month|\$|how much/i) && 
    !r.query.includes('TSA')
  );
  
  const scheduleFallbacks = fallbacks.filter(r => 
    r.query.match(/schedule|when|time|days|practice/i) &&
    !r.query.match(/\d\s*y(ear|o)/i)
  );

  const signupFallbacks = fallbacks.filter(r => 
    r.query.match(/sign|join|register|enroll|start/i)
  );

  if (costFallbacks.length > 0) {
    console.log('Cost/Fee Questions (missing Q&A):');
    costFallbacks.forEach(r => console.log(`  - "${r.query}"`));
  }

  if (scheduleFallbacks.length > 0) {
    console.log('\nSchedule Questions (missing Q&A):');
    scheduleFallbacks.forEach(r => console.log(`  - "${r.query}"`));
  }

  if (signupFallbacks.length > 0) {
    console.log('\nSign-up Questions (missing Q&A):');
    signupFallbacks.forEach(r => console.log(`  - "${r.query}"`));
  }

  // Recommendations
  console.log('\n\n💡 RECOMMENDATIONS:');
  console.log('==================\n');

  console.log('Based on real parent behavior patterns:\n');

  if (costFallbacks.length > 3) {
    console.log('1. Add these cost-related Q&A pairs:');
    console.log('   - "how much" → (same answer as "How much does TSA cost?")');
    console.log('   - "price" → (same answer)'); 
    console.log('   - "monthly fee" → (same answer)');
    console.log('   - "fees" → (same answer)\n');
  }

  if (scheduleFallbacks.length > 3) {
    console.log('2. Add general schedule Q&A pairs:');
    console.log('   - "schedule" → "Practice times vary by age group..."');
    console.log('   - "when is practice" → (same answer)');
    console.log('   - "practice times" → (same answer)\n');
  }

  if (signupFallbacks.length > 2) {
    console.log('3. Add sign-up Q&A pairs:');
    console.log('   - "how do i sign up" → "To join TSA, visit..."');
    console.log('   - "registration" → (same answer)\n');
  }

  console.log('4. Consider these patterns parents use:');
  console.log('   - Single words: "cost?", "schedule", "fees"');
  console.log('   - Informal: "how much", "whats the monthly"');
  console.log('   - Context-heavy: "my neighbor mentioned this..."');
  console.log('   - Age-specific: Very common, already handled well\n');
}

// Run the tests
runTests().catch(console.error);



