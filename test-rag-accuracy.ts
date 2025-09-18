#!/usr/bin/env node

import { config } from 'dotenv';
config({ path: '.env.local' });

interface RAGTest {
  question: string;
  expectedContent: string[];
  category: string;
}

// Test queries that SHOULD fall back to RAG and find correct info
const ragTests: RAGTest[] = [
  // Questions requiring synthesis from multiple parts
  {
    category: "Multi-part Questions",
    question: "What are all the fees I need to pay and when are they due?",
    expectedContent: [
      "$200/month", 
      "due on the 1st",
      "$75 registration",
      "$50 insurance",
      "$25 late fee after the 5th"
    ]
  },
  {
    category: "Policy Details",
    question: "What happens if I pick up my child late?",
    expectedContent: [
      "within 15 minutes",
      "$1/minute after 15 minutes"
    ]
  },
  {
    category: "Specific Requirements", 
    question: "What documents do I need to submit before my child can start?",
    expectedContent: [
      "birth certificate",
      "physical examination",
      "emergency contact",
      "medical insurance",
      "signed waiver"
    ]
  },
  {
    category: "Schedule Details",
    question: "When is practice for intermediate level kids?",
    expectedContent: [
      "Tuesday & Thursday",
      "5:00 PM - 7:00 PM",
      "Ages 9-12"
    ]
  },
  {
    category: "Complex Situational",
    question: "My child missed practice last week, can they make it up and how?",
    expectedContent: [
      "2 makeup sessions allowed per month",
      "must be used within 30 days",
      "Saturday Open Gym"
    ]
  },
  {
    category: "Facility Information",
    question: "Where is TSA located and what are the office hours?",
    expectedContent: [
      "1500 Sports Drive, Austin, TX",
      "Monday-Friday: 2:00 PM - 8:00 PM",
      "Saturday: 9:00 AM - 2:00 PM"
    ]
  },
  {
    category: "Academic Program",
    question: "How does the academic portion work?",
    expectedContent: [
      "9:00 AM - 11:30 AM",
      "personalized learning",
      "MAP testing",
      "parent portal"
    ]
  },
  {
    category: "Payment Options",
    question: "Are there any discounts available?",
    expectedContent: [
      "10% discount for second child",
      "15% for third",
      "5% quarterly payment",
      "10% annual payment"
    ]
  }
];

async function testRAGQuery(test: RAGTest): Promise<boolean> {
  console.log(`\n📝 Testing: "${test.question}"`);
  console.log(`Category: ${test.category}`);
  console.log(`Expected content: ${test.expectedContent.join(', ')}`);
  
  try {
    const response = await fetch('http://localhost:3000/api/q', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: test.question, audience: 'parent' })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let debugInfo: any = null;

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      fullResponse += chunk;
      
      // Extract debug info
      const debugMatch = chunk.match(/Q&A Search Debug: ({[\s\S]*?})\n/);
      if (debugMatch) {
        try {
          debugInfo = JSON.parse(debugMatch[1]);
        } catch (e) {}
      }
    }

    // Check if it fell back to RAG
    const usedRAG = debugInfo?.ragFallback === true;
    console.log(`\n  → ${usedRAG ? '✅ Used RAG' : '❌ Used Q&A'} (as expected)`);

    // Extract the actual answer from the stream
    // Look for content between specific markers or just check if key info is present
    const answerLower = fullResponse.toLowerCase();
    
    // Check if expected content appears in the answer
    const foundContent = test.expectedContent.filter(content => 
      answerLower.includes(content.toLowerCase())
    );

    const missingContent = test.expectedContent.filter(content => 
      !answerLower.includes(content.toLowerCase())
    );

    console.log(`\n  📊 Content Check:`);
    console.log(`  ✅ Found: ${foundContent.join(', ') || 'none'}`);
    if (missingContent.length > 0) {
      console.log(`  ❌ Missing: ${missingContent.join(', ')}`);
    }

    const accuracy = (foundContent.length / test.expectedContent.length) * 100;
    console.log(`  📈 Accuracy: ${accuracy.toFixed(0)}%`);

    // Show a snippet of the actual response
    const responseSnippet = fullResponse
      .replace(/Q&A Search Debug:[\s\S]*?\n/g, '')
      .replace(/\s+/g, ' ')
      .substring(0, 200);
    console.log(`\n  💬 Response snippet: "${responseSnippet}..."`);

    return accuracy >= 80; // Consider it successful if 80% of expected content is found
  } catch (error) {
    console.error(`  → Error: ${error.message}`);
    return false;
  }
}

async function runRAGTests() {
  console.log('🧪 Testing RAG Accuracy and Intelligence...\n');
  console.log('This tests whether your RAG system correctly retrieves and');
  console.log('synthesizes information from your content files.');
  console.log('================================================\n');

  const results: { test: RAGTest; success: boolean }[] = [];

  for (const test of ragTests) {
    const success = await testRAGQuery(test);
    results.push({ test, success });
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log('\n\n📊 RAG ACCURACY SUMMARY');
  console.log('======================\n');

  const successful = results.filter(r => r.success).length;
  const total = results.length;

  console.log(`Total tests: ${total}`);
  console.log(`Successful: ${successful} (${(successful/total * 100).toFixed(0)}%)`);
  console.log(`Failed: ${total - successful}`);

  // Group by category
  const byCategory = results.reduce((acc, { test, success }) => {
    if (!acc[test.category]) acc[test.category] = { success: 0, total: 0 };
    acc[test.category].total++;
    if (success) acc[test.category].success++;
    return acc;
  }, {} as Record<string, { success: number; total: number }>);

  console.log('\n📂 By Category:');
  Object.entries(byCategory).forEach(([category, stats]) => {
    const pct = (stats.success / stats.total * 100).toFixed(0);
    console.log(`  ${category}: ${stats.success}/${stats.total} (${pct}%)`);
  });

  console.log('\n\n💡 INSIGHTS:');
  console.log('============\n');

  if (successful === total) {
    console.log('✅ Your RAG system is working excellently!');
    console.log('   It\'s finding the right chunks and synthesizing accurate answers.');
  } else if (successful >= total * 0.8) {
    console.log('👍 Your RAG system is working well!');
    console.log('   Most queries are returning accurate information.');
    console.log('   The few misses might be due to chunking boundaries.');
  } else {
    console.log('⚠️  Your RAG system needs attention.');
    console.log('   Consider:');
    console.log('   - Reviewing your chunking strategy');
    console.log('   - Checking if content is properly indexed');
    console.log('   - Improving the system prompt');
  }
}

// Run the tests
runRAGTests().catch(console.error);



