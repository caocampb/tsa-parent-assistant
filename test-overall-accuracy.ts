#!/usr/bin/env node

import { config } from 'dotenv';
config({ path: '.env.local' });

interface AccuracyTest {
  question: string;
  expectedContent: string[];
  category: string;
}

// Test BOTH Q&A and RAG - we care about accuracy, not which system answers
const accuracyTests: AccuracyTest[] = [
  // Common parent questions
  {
    category: "Cost Questions",
    question: "How much is the monthly tuition?",
    expectedContent: ["$200", "month"]
  },
  {
    category: "Cost Questions", 
    question: "What's the total cost including all fees?",
    expectedContent: ["$200", "$75", "$50"]
  },
  {
    category: "Schedule Questions",
    question: "When does my 8 year old practice?",
    expectedContent: ["Monday", "Wednesday", "4:00", "6:00"]
  },
  {
    category: "Policy Questions",
    question: "What's your late pickup policy?",
    expectedContent: ["15 minutes", "$1", "minute"]
  },
  {
    category: "Requirements",
    question: "What forms do I need to fill out?",
    expectedContent: ["birth certificate", "physical", "emergency"]
  },
  {
    category: "Complex Questions",
    question: "My family is new to Austin and we have 2 kids ages 6 and 10, what do we need to know?",
    expectedContent: ["different", "age", "group"]
  },
  {
    category: "Edge Cases",
    question: "Is there a trial period or can we try a class?",
    expectedContent: [] // This might not have a clear answer
  },
  {
    category: "Specific Details",
    question: "Who is the coach for beginners?",
    expectedContent: ["Sarah Thompson", "Coach Sarah"]
  }
];

async function testAccuracy(test: AccuracyTest): Promise<{ 
  success: boolean; 
  usedQA: boolean; 
  accuracy: number;
  response: string;
}> {
  console.log(`\n📝 Testing: "${test.question}"`);
  console.log(`Category: ${test.category}`);
  
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
    let answer = '';

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

      // Extract answer
      const answerMatch = chunk.match(/"answer":"([^"]*(?:\\.[^"]*)*)"/);
      if (answerMatch) {
        answer = answerMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');
      }
    }

    const usedQA = debugInfo?.willUseQA === true;
    const usedRAG = debugInfo?.ragFallback === true;
    
    console.log(`  → System: ${usedQA ? '⚡ Q&A (fast)' : '🤖 RAG (intelligent)'}`);

    // Check accuracy
    const answerLower = answer.toLowerCase();
    const foundContent = test.expectedContent.filter(content => 
      answerLower.includes(content.toLowerCase())
    );

    const accuracy = test.expectedContent.length > 0 
      ? (foundContent.length / test.expectedContent.length) * 100
      : answer.length > 20 ? 100 : 0; // If no expected content, check if we got a reasonable answer

    console.log(`  → Accuracy: ${accuracy.toFixed(0)}%`);
    
    if (test.expectedContent.length > 0) {
      console.log(`  → Found: ${foundContent.join(', ') || 'none'}`);
      const missing = test.expectedContent.filter(c => !foundContent.includes(c));
      if (missing.length > 0) {
        console.log(`  → Missing: ${missing.join(', ')}`);
      }
    }

    // Show answer snippet
    console.log(`  💬 "${answer.substring(0, 150)}${answer.length > 150 ? '...' : ''}"`);

    return {
      success: accuracy >= 70,
      usedQA,
      accuracy,
      response: answer
    };
  } catch (error) {
    console.error(`  → Error: ${error.message}`);
    return { success: false, usedQA: false, accuracy: 0, response: '' };
  }
}

async function runAccuracyTests() {
  console.log('🎯 Testing Overall System Accuracy...\n');
  console.log('This tests whether parents get accurate answers,');
  console.log('regardless of whether they come from Q&A or RAG.');
  console.log('==============================================\n');

  const results: Array<{
    test: AccuracyTest;
    result: Awaited<ReturnType<typeof testAccuracy>>;
  }> = [];

  for (const test of accuracyTests) {
    const result = await testAccuracy(test);
    results.push({ test, result });
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Summary
  console.log('\n\n📊 OVERALL SYSTEM ACCURACY');
  console.log('==========================\n');

  const successful = results.filter(r => r.result.success).length;
  const total = results.length;
  const qaCount = results.filter(r => r.result.usedQA).length;
  const ragCount = results.filter(r => !r.result.usedQA).length;

  console.log(`Total queries: ${total}`);
  console.log(`Accurate answers: ${successful} (${(successful/total * 100).toFixed(0)}%)`);
  console.log(`\nSystem usage:`);
  console.log(`  ⚡ Q&A pairs: ${qaCount} queries`);
  console.log(`  🤖 RAG: ${ragCount} queries`);

  // Performance comparison
  const qaResults = results.filter(r => r.result.usedQA);
  const ragResults = results.filter(r => !r.result.usedQA);
  
  if (qaResults.length > 0) {
    const qaAccuracy = qaResults.filter(r => r.result.success).length / qaResults.length * 100;
    console.log(`\n⚡ Q&A Accuracy: ${qaAccuracy.toFixed(0)}%`);
  }
  
  if (ragResults.length > 0) {
    const ragAccuracy = ragResults.filter(r => r.result.success).length / ragResults.length * 100;
    console.log(`🤖 RAG Accuracy: ${ragAccuracy.toFixed(0)}%`);
  }

  // Category breakdown
  console.log('\n📂 By Category:');
  const byCategory = results.reduce((acc, { test, result }) => {
    if (!acc[test.category]) {
      acc[test.category] = { total: 0, successful: 0, qa: 0, rag: 0 };
    }
    acc[test.category].total++;
    if (result.success) acc[test.category].successful++;
    if (result.usedQA) acc[test.category].qa++;
    else acc[test.category].rag++;
    return acc;
  }, {} as Record<string, any>);

  Object.entries(byCategory).forEach(([category, stats]: [string, any]) => {
    const pct = (stats.successful / stats.total * 100).toFixed(0);
    console.log(`  ${category}: ${pct}% accurate (${stats.qa} Q&A, ${stats.rag} RAG)`);
  });

  console.log('\n\n💡 KEY FINDINGS:');
  console.log('================\n');

  if (successful === total) {
    console.log('🎉 Perfect accuracy! Your system is answering all questions correctly.');
  } else if (successful >= total * 0.8) {
    console.log('✅ Excellent accuracy! Most parent questions are answered correctly.');
  } else {
    console.log('⚠️  Some accuracy issues detected.');
  }

  // Specific insights
  const noAnswerQueries = results.filter(r => 
    r.result.response.includes("don't have") || 
    r.result.response.includes("contact TSA")
  );

  if (noAnswerQueries.length > 0) {
    console.log(`\n📝 ${noAnswerQueries.length} queries couldn't find answers:`);
    noAnswerQueries.forEach(({ test }) => {
      console.log(`   - "${test.question}"`);
    });
  }

  console.log('\n🏁 Bottom Line:');
  console.log(`Parents are getting accurate answers ${(successful/total * 100).toFixed(0)}% of the time.`);
  if (successful < total) {
    console.log('Consider adding Q&A pairs for the questions that failed.');
  }
}

// Run the tests
runAccuracyTests().catch(console.error);



