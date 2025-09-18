#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DiagnosticResult {
  test: string;
  finding: string;
  severity: 'critical' | 'warning' | 'ok';
}

const results: DiagnosticResult[] = [];

async function testChunkingIssue() {
  console.log('\n🔍 TEST 1: Chunking Boundaries');
  console.log('================================');
  console.log('Testing if critical information is split across chunks...\n');

  // Get all parent chunks to analyze
  const { data: chunks, error } = await supabase
    .from('document_chunks')
    .select('content, metadata')
    .eq('metadata->audience', 'parent')
    .order('id');

  if (!chunks) {
    console.log('❌ Could not retrieve chunks');
    return;
  }

  console.log(`Total parent chunks: ${chunks.length}`);

  // Search for specific payment info
  const searchTerms = ['$200/month', 'Monthly Tuition', 'due on the 1st', 'late fee'];
  
  for (const term of searchTerms) {
    const foundChunks = chunks.filter(c => c.content.toLowerCase().includes(term.toLowerCase()));
    
    console.log(`\nSearching for "${term}":`);
    if (foundChunks.length > 0) {
      console.log(`  ✅ Found in ${foundChunks.length} chunk(s)`);
      
      // Check if related info is in same chunk
      const chunk = foundChunks[0];
      const hasMonthlyAmount = chunk.content.includes('$200');
      const hasDueDate = chunk.content.includes('1st');
      const hasLateFee = chunk.content.includes('$25');
      
      if (term === 'Monthly Tuition' && (!hasMonthlyAmount || !hasDueDate)) {
        console.log(`  ⚠️  Payment details split across chunks!`);
        console.log(`    - Has $200: ${hasMonthlyAmount}`);
        console.log(`    - Has due date: ${hasDueDate}`);
        console.log(`    - Chunk snippet: "${chunk.content.substring(0, 100)}..."`);
        results.push({
          test: 'Chunking',
          finding: 'Payment info split across multiple chunks',
          severity: 'critical'
        });
      }
    } else {
      console.log(`  ❌ Not found in any chunks!`);
      results.push({
        test: 'Chunking',
        finding: `"${term}" not indexed in chunks`,
        severity: 'critical'
      });
    }
  }
}

async function testRetrievalIssue() {
  console.log('\n\n🔍 TEST 2: Embedding Retrieval');
  console.log('================================');
  console.log('Testing if embeddings match user queries to content...\n');

  const testQueries = [
    { query: 'monthly tuition', expectedContent: '$200' },
    { query: 'monthly fee', expectedContent: '$200' },
    { query: 'registration requirements', expectedContent: 'birth certificate' }
  ];

  for (const test of testQueries) {
    // Get embedding for query
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: test.query
      })
    });

    const { data } = await embeddingResponse.json();
    const queryEmbedding = data[0].embedding;

    // Search with this embedding
    const { data: chunks, error } = await supabase.rpc('search_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
      filter_audience: 'parent'
    });

    console.log(`Query: "${test.query}"`);
    if (chunks && chunks.length > 0) {
      const topChunk = chunks[0];
      const hasExpectedContent = topChunk.content.includes(test.expectedContent);
      console.log(`  Top match similarity: ${topChunk.similarity.toFixed(3)}`);
      console.log(`  Contains expected content: ${hasExpectedContent ? '✅' : '❌'}`);
      
      if (!hasExpectedContent) {
        console.log(`  Retrieved chunk snippet: "${topChunk.content.substring(0, 100)}..."`);
        results.push({
          test: 'Retrieval',
          finding: `Query "${test.query}" retrieves wrong chunk`,
          severity: 'critical'
        });
      }
    } else {
      console.log(`  ❌ No chunks retrieved!`);
      results.push({
        test: 'Retrieval',
        finding: `Query "${test.query}" retrieves nothing`,
        severity: 'critical'
      });
    }
  }
}

async function testPromptIssue() {
  console.log('\n\n🔍 TEST 3: LLM Response Generation');
  console.log('===================================');
  console.log('Testing actual system responses to diagnose prompt issues...\n');

  const testCases = [
    {
      question: 'How much is the monthly tuition?',
      expectedInAnswer: '$200'
    },
    {
      question: 'What documents do I need?',
      expectedInAnswer: 'birth certificate'
    }
  ];

  for (const test of testCases) {
    console.log(`Testing: "${test.question}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/q', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: test.question,
          audience: 'parent'
        })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let answer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        fullResponse += chunk;
        
        // Extract answer
        const answerMatch = chunk.match(/"answer":"([^"]*(?:\\.[^"]*)*)"/);
        if (answerMatch) {
          answer = answerMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');
        }
      }

      const hasAnswer = !answer.includes("don't have") && 
                       !answer.includes("not available") &&
                       !answer.includes("contact TSA");
      
      const hasExpectedContent = answer.toLowerCase().includes(test.expectedInAnswer.toLowerCase());
      
      console.log(`  → System gave an answer: ${hasAnswer ? '✅' : '❌'}`);
      console.log(`  → Contains expected info: ${hasExpectedContent ? '✅' : '❌'}`);
      
      if (!hasAnswer) {
        console.log(`  → Response: "${answer.substring(0, 150)}..."`);
        results.push({
          test: 'Prompt',
          finding: `GPT-5 claims no info for "${test.question}"`,
          severity: 'critical'
        });
      } else if (!hasExpectedContent) {
        console.log(`  → Response: "${answer.substring(0, 150)}..."`);
        results.push({
          test: 'Prompt',
          finding: `Answer missing key info for "${test.question}"`,
          severity: 'warning'
        });
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
}

async function checkDocumentIndexing() {
  console.log('\n\n🔍 BONUS: Document Indexing Check');
  console.log('==================================');
  console.log('Verifying documents were properly chunked...\n');

  const { data: stats } = await supabase
    .from('document_chunks')
    .select('metadata')
    .eq('metadata->audience', 'parent');

  const fileCount = new Set(stats?.map(s => s.metadata.file)).size;
  console.log(`Total parent chunks: ${stats?.length || 0}`);
  console.log(`From ${fileCount} files`);

  if (!stats || stats.length < 10) {
    results.push({
      test: 'Indexing',
      finding: 'Very few document chunks indexed',
      severity: 'critical'
    });
  }
}

async function runDiagnostics() {
  console.log('🏥 RAG System Diagnostics');
  console.log('========================\n');
  console.log('Running tests to identify why RAG fails on certain queries...');

  await testChunkingIssue();
  await testRetrievalIssue();
  await testPromptIssue();
  await checkDocumentIndexing();

  // Summary
  console.log('\n\n📊 DIAGNOSTIC SUMMARY');
  console.log('====================\n');

  const critical = results.filter(r => r.severity === 'critical');
  const warnings = results.filter(r => r.severity === 'warning');

  if (critical.length === 0) {
    console.log('✅ No critical issues found!');
  } else {
    console.log(`🔴 ${critical.length} CRITICAL ISSUES:\n`);
    critical.forEach(r => {
      console.log(`  ${r.test}: ${r.finding}`);
    });
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} WARNINGS:\n`);
    warnings.forEach(r => {
      console.log(`  ${r.test}: ${r.finding}`);
    });
  }

  // Root cause analysis
  console.log('\n\n🎯 ROOT CAUSE ANALYSIS');
  console.log('======================\n');

  const hasChunkingIssues = results.some(r => r.test === 'Chunking' && r.severity === 'critical');
  const hasRetrievalIssues = results.some(r => r.test === 'Retrieval' && r.severity === 'critical');
  const hasPromptIssues = results.some(r => r.test === 'Prompt' && r.severity === 'critical');

  if (hasChunkingIssues) {
    console.log('1. CHUNKING PROBLEM CONFIRMED ❌');
    console.log('   → Information is split across chunk boundaries');
    console.log('   → Consider larger chunks or overlapping windows');
  } else {
    console.log('1. Chunking appears OK ✅');
  }

  if (hasRetrievalIssues) {
    console.log('\n2. RETRIEVAL PROBLEM CONFIRMED ❌');
    console.log('   → Embeddings not matching queries to content');
    console.log('   → User vocabulary differs from document vocabulary');
    console.log('   → Add more Q&A pairs to bridge the gap');
  } else {
    console.log('\n2. Retrieval appears OK ✅');
  }

  if (hasPromptIssues) {
    console.log('\n3. PROMPT PROBLEM CONFIRMED ❌');
    console.log('   → GPT-5 being too conservative');
    console.log('   → Update system prompt to be more assertive');
  } else {
    console.log('\n3. Prompt handling appears OK ✅');
  }
}

// Run diagnostics
runDiagnostics().catch(console.error);
