#!/usr/bin/env node

// Edge case testing for the improved RAG system

async function testAPI(question: string, description: string) {
  const response = await fetch('http://localhost:3000/api/q', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, audience: 'parent' })
  });
  
  const data = await response.json();
  console.log(`\n${description}`);
  console.log(`Q: "${question}"`);
  console.log(`A: ${data.answer?.substring(0, 80)}...`);
  console.log(`Source: ${data.sources?.[0]?.type || 'none'}, Confidence: ${(data.confidence || 0).toFixed(3)}`);
  return data;
}

async function main() {
  console.log('=== EDGE CASE TESTING ===\n');
  
  console.log('1. EXTREME INPUT VARIATIONS:');
  console.log('-----------------------------');
  await testAPI('', 'Empty string');
  await testAPI('   ', 'Only spaces');
  await testAPI('???', 'Only punctuation');
  await testAPI('HOWMUCHDOESTSACOST', 'No spaces');
  await testAPI('h o w   m u c h ?', 'Excessive spaces');
  await testAPI('How much does TSA cost?!?!?!?!', 'Excessive punctuation');
  await testAPI('🤔💰❓', 'Only emojis');
  await testAPI('How much 💰 does TSA cost?', 'Mixed text and emojis');
  
  console.log('\n\n2. TYPOS AND MISSPELLINGS:');
  console.log('---------------------------');
  await testAPI('How mcuh does TSA cost?', 'Common typo');
  await testAPI('Hw much dos TSA cst?', 'Multiple typos');
  await testAPI('How much does TAS cost?', 'Wrong acronym');
  await testAPI('How much does it cost?', 'Generic "it"');
  
  console.log('\n\n3. INCOMPLETE QUESTIONS:');
  console.log('------------------------');
  await testAPI('how', 'Single word');
  await testAPI('cost', 'Single keyword');
  await testAPI('practice time', 'No question structure');
  await testAPI('my child', 'Incomplete thought');
  
  console.log('\n\n4. COMPLEX NATURAL LANGUAGE:');
  console.log('-----------------------------');
  await testAPI('Ok so my neighbor told me about TSA and I was wondering what the monthly fees are?', 'Conversational');
  await testAPI('I have twins, one is 7 and one is 9, when do they practice?', 'Multiple entities');
  await testAPI('If I sign up today how much will I pay this month?', 'Time-dependent');
  await testAPI('My husband wants to know about the cost and also the schedule', 'Multiple questions');
  
  console.log('\n\n5. BOUNDARY TESTING:');
  console.log('--------------------');
  await testAPI('a'.repeat(500), 'Very long input (500 chars)');
  await testAPI('What is the cost? '.repeat(10), 'Repeated question');
  await testAPI('TELL ME EVERYTHING ABOUT EVERYTHING NOW!!!', 'Demanding tone');
  await testAPI('cost cost cost cost cost', 'Repeated keywords');
  
  console.log('\n\n6. AMBIGUOUS QUESTIONS:');
  console.log('-----------------------');
  await testAPI('Is it worth it?', 'Subjective question');
  await testAPI('Why?', 'Too vague');
  await testAPI('Tell me more', 'No context');
  await testAPI('What about the other thing?', 'Unclear reference');
  
  console.log('\n\n7. MIXED LANGUAGES/SLANG:');
  console.log('-------------------------');
  await testAPI('How much dinero?', 'Spanish mixed');
  await testAPI('Whats the damage?', 'Slang for cost');
  await testAPI('How much moolah we talking?', 'Informal slang');
  await testAPI('¿Cuánto cuesta?', 'Full Spanish');
  
  console.log('\n\n8. COACH VS PARENT CONFUSION:');
  console.log('------------------------------');
  await testAPI('What is my revenue split?', 'Coach question from parent');
  await testAPI('How much insurance do I need?', 'Ambiguous audience');
  await testAPI('Tell me about the $15k', 'Coach-specific info');
}

// Run tests
setTimeout(main, 2000);



