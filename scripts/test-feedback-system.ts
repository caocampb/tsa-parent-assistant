import { supabase } from '../lib/supabase';

async function testFeedbackSystem() {
  console.log('🧪 Testing Feedback System...\n');
  
  // Test 1: Check if table exists
  console.log('1️⃣ Checking if answer_feedback table exists...');
  try {
    const { data: tableCheck, error: tableError } = await supabase
      .from('answer_feedback')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Table check failed:', tableError.message);
      return;
    }
    console.log('✅ Table exists!\n');
  } catch (err) {
    console.error('❌ Table check error:', err);
    return;
  }
  
  // Test 2: Check if view exists
  console.log('2️⃣ Checking if recent_feedback_issues view exists...');
  try {
    const { data: viewCheck, error: viewError } = await supabase
      .from('recent_feedback_issues')
      .select('*')
      .limit(1);
    
    if (viewError) {
      console.error('❌ View check failed:', viewError.message);
      return;
    }
    console.log('✅ View exists!');
    console.log('   Current issues:', viewCheck?.length || 0, '\n');
  } catch (err) {
    console.error('❌ View check error:', err);
    return;
  }
  
  // Test 3: Test the feedback API
  console.log('3️⃣ Testing feedback API endpoint...');
  try {
    const testFeedback = {
      question: "Test question from script",
      answer: "Test answer from script",
      audience: "parent" as const,
      feedback: "up" as const,
      chunk_ids: ['550e8400-e29b-41d4-a716-446655440000'],
      chunk_scores: [0.85],
      chunk_sources: ['parent'],
      search_type: 'hybrid' as const,
      confidence_score: 0.85,
      response_time_ms: 1234
    };
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch('http://localhost:3002/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testFeedback),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ API test failed:', response.status, error);
      return;
    }
    
    const result = await response.json();
    console.log('✅ API test successful!');
    console.log('   Response:', result, '\n');
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log('⏭️  API test timed out (server might be starting up)');
      console.log('   Skipping to database tests...\n');
    } else {
      console.error('❌ API test error:', err.message);
      console.log('   (Make sure the dev server is running on port 3002)\n');
    }
  }
  
  // Test 4: Insert test feedback directly
  console.log('4️⃣ Inserting test feedback directly...');
  try {
    const { data: insertData, error: insertError } = await supabase
      .from('answer_feedback')
      .insert([
        {
          question: "What are the practice times?",
          answer: "Practice times vary by level...",
          audience: 'parent',
          feedback: 'down',
          search_type: 'hybrid',
          confidence_score: 0.65
        },
        {
          question: "What are the practice times?",
          answer: "Practice times vary by level...",
          audience: 'parent',
          feedback: 'up',
          search_type: 'qa_pair',
          confidence_score: 0.95
        }
      ])
      .select();
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError.message);
      return;
    }
    console.log('✅ Test feedback inserted!');
    console.log('   Records created:', insertData?.length || 0, '\n');
  } catch (err) {
    console.error('❌ Insert error:', err);
    return;
  }
  
  // Test 5: Query recent issues
  console.log('5️⃣ Querying recent feedback issues...');
  try {
    const { data: issues, error: issuesError } = await supabase
      .from('recent_feedback_issues')
      .select('*')
      .order('thumbs_down', { ascending: false });
    
    if (issuesError) {
      console.error('❌ Issues query failed:', issuesError.message);
      return;
    }
    
    console.log('✅ Issues query successful!');
    if (issues && issues.length > 0) {
      console.log('\n📊 Current problematic questions:');
      issues.forEach((issue: any) => {
        console.log(`   - "${issue.question}"`);
        console.log(`     👎 ${issue.thumbs_down} | 👍 ${issue.thumbs_up} | Total: ${issue.total_asks}`);
      });
    } else {
      console.log('   No issues found (good news!)');
    }
    console.log('\n');
  } catch (err) {
    console.error('❌ Issues query error:', err);
    return;
  }
  
  // Test 6: Check data structure
  console.log('6️⃣ Checking data structure...');
  try {
    const { data: sample, error: sampleError } = await supabase
      .from('answer_feedback')
      .select('*')
      .limit(1)
      .single();
    
    if (sampleError && sampleError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('❌ Structure check failed:', sampleError.message);
      return;
    }
    
    if (sample) {
      console.log('✅ Sample record structure:');
      console.log('   Fields:', Object.keys(sample).join(', '));
      console.log('   Has arrays:', {
        chunk_ids: Array.isArray(sample.chunk_ids),
        chunk_scores: Array.isArray(sample.chunk_scores),
        chunk_sources: Array.isArray(sample.chunk_sources)
      });
    } else {
      console.log('ℹ️  No records yet, but table structure is valid');
    }
  } catch (err) {
    console.error('❌ Structure check error:', err);
  }
  
  console.log('\n✨ Feedback system test complete!');
  console.log('Next steps:');
  console.log('1. Visit http://localhost:3002 and ask a question');
  console.log('2. Click thumbs up/down on the answer');
  console.log('3. Go to http://localhost:3002/admin/qa');
  console.log('4. Click "Check Issues" to see feedback data');
}

// Run the test
testFeedbackSystem().catch(console.error);
