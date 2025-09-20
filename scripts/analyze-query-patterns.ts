#!/usr/bin/env bun

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Common query patterns for Dash
const dashVariations = [
  'what is dash',
  'whats dash',
  'dash system',
  'dash login',
  'how to use dash',
  'dash portal',
  'parent dashboard',
  'check dash',
  'dash app',
  'student progress dash'
];

const mapVariations = [
  'MAP test',
  'MAP testing',
  'what is MAP',
  'MAP scores',
  'MAP results'
];

const homeworkVariations = [
  'homework',
  'hw',
  'home work',
  'assignments',
  'work at home'
];

async function testQueryVariations() {
  console.log('🔍 Testing common query patterns...\n');
  
  const results = {
    dash: { total: 0, matched: 0 },
    map: { total: 0, matched: 0 },
    homework: { total: 0, matched: 0 }
  };
  
  // Test Dash variations
  console.log('DASH SYSTEM QUERIES:');
  for (const query of dashVariations) {
    const response = await fetch('http://localhost:3000/api/q', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query, audience: 'parent' })
    });
    
    const data = await response.json();
    results.dash.total++;
    
    if (data.confidence > 0.3) {
      results.dash.matched++;
      console.log(`✅ "${query}" → ${(data.confidence * 100).toFixed(1)}%`);
    } else {
      console.log(`❌ "${query}" → No match`);
    }
  }
  
  // Summary
  console.log('\n📊 BOTTLENECK ANALYSIS:');
  console.log('========================');
  
  const dashSuccessRate = (results.dash.matched / results.dash.total) * 100;
  console.log(`\nDash System:`);
  console.log(`  Success rate: ${dashSuccessRate.toFixed(1)}%`);
  console.log(`  Failed queries: ${results.dash.total - results.dash.matched}/${results.dash.total}`);
  
  if (dashSuccessRate < 50) {
    console.log(`  ⚠️  TRUE BOTTLENECK - Most variations fail!`);
  } else if (dashSuccessRate < 80) {
    console.log(`  ⚠️  PARTIAL BOTTLENECK - Some important variations fail`);
  } else {
    console.log(`  ✅ NOT A BOTTLENECK - Most variations work`);
  }
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (dashSuccessRate < 80) {
    console.log('1. Add query expansion for "dash" → "Dash system"');
    console.log('2. Or add common variations as Q&A pairs');
    console.log('3. Or implement fuzzy matching for key terms');
  }
}

testQueryVariations().catch(console.error);


