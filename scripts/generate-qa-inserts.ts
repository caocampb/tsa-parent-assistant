import qaPairs from '../qa_pairs_extraction.json';

// Generate SQL INSERT statements for manual execution
console.log('-- Q&A Pairs INSERT statements for Supabase SQL Editor');
console.log('-- Copy and paste these into your Supabase SQL editor\n');

qaPairs.qa_pairs.forEach((pair, index) => {
  // Escape single quotes in the text
  const question = pair.question.replace(/'/g, "''");
  const answer = pair.answer.replace(/'/g, "''");
  
  console.log(`-- ${index + 1}. ${pair.question.substring(0, 50)}...`);
  console.log(`INSERT INTO qa_pairs (question, answer, category, audience)`);
  console.log(`VALUES (`);
  console.log(`  '${question}',`);
  console.log(`  '${answer}',`);
  console.log(`  '${pair.category}',`);
  console.log(`  '${pair.audience}'`);
  console.log(`);\n`);
});


