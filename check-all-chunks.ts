#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

async function checkAllChunks() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get ALL parent chunks
  const { data: parentChunks, error: parentError } = await supabase
    .from('document_chunks_parent')
    .select('content, chunk_index')
    .order('chunk_index');

  if (parentError) {
    console.log('Error fetching parent chunks:', parentError);
    return;
  }

  console.log(`Found ${parentChunks?.length || 0} parent chunks\n`);
  
  // Display all chunks
  let fullContent = '';
  parentChunks?.forEach((chunk) => {
    console.log(`\n=== CHUNK ${chunk.chunk_index} ===`);
    console.log(chunk.content);
    console.log(`(${chunk.content.length} characters)`);
    fullContent += chunk.content + '\n';
  });

  // Check what's missing
  console.log('\n\n=== CONTENT COVERAGE CHECK ===');
  console.log('Has $200/month fee:', fullContent.includes('$200'));
  console.log('Has registration fee $75:', fullContent.includes('$75'));
  console.log('Has late fee $25:', fullContent.includes('$25'));
  console.log('Has practice schedule:', fullContent.includes('4:00 PM'));
  console.log('Has Coach Johnson:', fullContent.includes('Coach Johnson'));
  console.log('Has uniform info:', fullContent.includes('uniform'));
  
  // Check if we're missing content from the original file
  console.log('\n\n=== COMPARING TO SOURCE FILE ===');
  const fs = require('fs');
  const originalContent = fs.readFileSync('content/parent-handbook.txt', 'utf-8');
  console.log(`Original file: ${originalContent.length} characters`);
  console.log(`Chunks total: ${fullContent.length} characters`);
  
  // Find what's in the original but not in chunks
  const lines = originalContent.split('\n');
  const missingLines = lines.filter(line => 
    line.trim() && !fullContent.includes(line.trim())
  );
  
  if (missingLines.length > 0) {
    console.log(`\n⚠️  Missing ${missingLines.length} lines from chunks:`);
    missingLines.slice(0, 10).forEach(line => {
      console.log(`  - "${line.substring(0, 50)}..."`);
    });
  }
}

checkAllChunks().catch(console.error);



