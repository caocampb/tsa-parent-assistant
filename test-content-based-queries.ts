#!/usr/bin/env node

import { config } from 'dotenv';
config({ path: '.env.local' });

interface TestResult {
  query: string;
  expectedInfo: string;
  matched: boolean;
  similarity?: number;
  ragFallback: boolean;
  responseTime: number;
}

const results: TestResult[] = [];

// Based on ACTUAL content in parent-handbook.txt and shared-info.txt
const realParentQueries = [
  // Cost questions - from parent-handbook.txt lines 27-40
  {
    query: "how much per month",
    expectedInfo: "$200/month"
  },
  {
    query: "monthly tuition",
    expectedInfo: "$200/month"
  },
  {
    query: "what's the late fee",
    expectedInfo: "$25 late fee after the 5th"
  },
  {
    query: "registration fee",
    expectedInfo: "$75 one-time"
  },
  {
    query: "do you have sibling discounts",
    expectedInfo: "10% discount for second child"
  },
  
  // Schedule questions - from parent-handbook.txt lines 46-63
  {
    query: "when does my 6 year old practice",
    expectedInfo: "Monday & Wednesday, 4:00 PM - 6:00 PM"
  },
  {
    query: "practice schedule for beginners",
    expectedInfo: "Monday & Wednesday, 4:00 PM - 6:00 PM"
  },
  {
    query: "what time is practice for 5-8 year olds",
    expectedInfo: "4:00 PM - 6:00 PM"
  },
  {
    query: "saturday open gym hours",
    expectedInfo: "10:00 AM - 12:00 PM"
  },
  
  // Logistics - from shared-info.txt and parent-handbook.txt
  {
    query: "where is the facility",
    expectedInfo: "1500 Sports Drive, Austin, TX 78701"
  },
  {
    query: "what's the address",
    expectedInfo: "1500 Sports Drive, Austin, TX 78701"
  },
  {
    query: "office hours",
    expectedInfo: "Monday-Friday: 2:00 PM - 8:00 PM"
  },
  {
    query: "phone number",
    expectedInfo: "(512) 555-8722"
  },
  
  // Policies - from parent-handbook.txt lines 97-117
  {
    query: "pickup policy", 
    expectedInfo: "within 15 minutes after practice"
  },
  {
    query: "late pickup fee",
    expectedInfo: "$1/minute after 15 minutes"
  },
  {
    query: "can we do makeup classes",
    expectedInfo: "2 makeup sessions allowed per month"
  },
  {
    query: "makeup policy",
    expectedInfo: "must be used within 30 days"
  },
  
  // Requirements - from parent-handbook.txt
  {
    query: "what documents do I need",
    expectedInfo: "birth certificate, physical exam, emergency contact"
  },
  {
    query: "uniform cost",
    expectedInfo: "$45 for standard package"
  },
  {
    query: "where to buy uniforms",
    expectedInfo: "TSA Pro Shop in main lobby"
  },
  
  // Academic program - from shared-info.txt
  {
    query: "daily schedule",
    expectedInfo: "9:00 AM - 11:30 AM academics, 12:15 PM - 3:30 PM sports"
  },
  {
    query: "what time is academics",
    expectedInfo: "9:00 AM - 11:30 AM"
  },
  
  // Common parent concerns
  {
    query: "private lessons cost",
    expectedInfo: "$75/hour"
  },
  {
    query: "are coaches certified",
    expectedInfo: "CPR/First Aid certified"
  },
  {
    query: "class size",
    expectedInfo: "15 athletes for beginner level"
  }
];

async function testQuery(queryData: typeof realParentQueries[0]): Promise<void> {
  const { query, expectedInfo } = queryData;
  console.log(`\nTesting: "${query}"`);
  console.log(`Expected: ${expectedInfo}`);
  
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
        expectedInfo,
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
  console.log('🧪 Testing Queries Based on Actual Content Files...\n');
  console.log('These queries test what parents would ask about the SPECIFIC');
  console.log('information documented in parent-handbook.txt and shared-info.txt');
  console.log('====================================================\n');

  // Test in smaller batches
  const batchSize = 5;
  for (let i = 0; i < realParentQueries.length; i += batchSize) {
    const batch = realParentQueries.slice(i, i + batchSize);
    await Promise.all(batch.map(query => testQuery(query)));
    
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

  // Group by topic
  console.log('\n\n🔍 KEY MISSING Q&A PAIRS:');
  console.log('========================\n');

  const costQueries = fallbacks.filter(r => 
    r.query.match(/month|fee|cost|discount|tuition|price/i)
  ).slice(0, 5);

  const scheduleQueries = fallbacks.filter(r => 
    r.query.match(/practice|schedule|time|hours|when/i)
  ).slice(0, 5);

  const logisticsQueries = fallbacks.filter(r => 
    r.query.match(/where|address|facility|phone|office/i)
  ).slice(0, 5);

  if (costQueries.length > 0) {
    console.log('Cost Questions (info is in parent-handbook.txt):');
    costQueries.forEach(r => console.log(`  - "${r.query}" → ${r.expectedInfo}`));
  }

  if (scheduleQueries.length > 0) {
    console.log('\nSchedule Questions (info is in parent-handbook.txt):');
    scheduleQueries.forEach(r => console.log(`  - "${r.query}" → ${r.expectedInfo}`));
  }

  if (logisticsQueries.length > 0) {
    console.log('\nLogistics Questions (info is in shared-info.txt):');
    logisticsQueries.forEach(r => console.log(`  - "${r.query}" → ${r.expectedInfo}`));
  }

  console.log('\n\n💡 INSIGHT:');
  console.log('===========\n');
  console.log('Your content files have ALL this information, but parents are asking');
  console.log('questions that don\'t match your Q&A pairs. The RAG system has to dig');
  console.log('through chunks to find simple answers that could be instant Q&A hits.\n');
  console.log('Example: Parent asks "how much per month" → Answer is clearly "$200/month"');
  console.log('but without a Q&A pair, it falls back to slower RAG search.\n');
}

// Run the tests
runTests().catch(console.error);



