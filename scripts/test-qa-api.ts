#!/usr/bin/env bun

import { config } from 'dotenv';
config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000/api/qa-pairs';

// Test Q&A pair
const testQA = {
  question: "API Test: What are the office hours?",
  answer: "Our office is open Monday-Friday 3:00 PM - 7:00 PM.",
  audience: "parent",
  category: "logistics"
};

async function testAPI() {
  console.log('🧪 Testing Q&A API...\n');

  try {
    // 1. Test GET (list)
    console.log('1️⃣ Testing GET /api/qa-pairs');
    const listResponse = await fetch(`${BASE_URL}?audience=parent&limit=5`);
    const listData = await listResponse.json();
    console.log(`✅ Listed ${listData.data?.length || 0} Q&A pairs`);
    console.log(`   Total: ${listData.pagination?.total || 0}\n`);

    // 2. Test POST (create)
    console.log('2️⃣ Testing POST /api/qa-pairs');
    const createResponse = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testQA)
    });
    const created = await createResponse.json();
    
    if (createResponse.ok) {
      console.log(`✅ Created Q&A pair: ${created.id}`);
      console.log(`   Question: ${created.question}\n`);
    } else {
      console.error('❌ Failed to create:', created.error);
      return;
    }

    // 3. Test GET single
    console.log(`3️⃣ Testing GET /api/qa-pairs/${created.id}`);
    const getResponse = await fetch(`${BASE_URL}/${created.id}`);
    const fetched = await getResponse.json();
    
    if (getResponse.ok) {
      console.log(`✅ Fetched Q&A pair: ${fetched.id}\n`);
    } else {
      console.error('❌ Failed to fetch:', fetched.error);
    }

    // 4. Test PATCH (update)
    console.log(`4️⃣ Testing PATCH /api/qa-pairs/${created.id}`);
    const updateResponse = await fetch(`${BASE_URL}/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer: "Updated: Our office is open Monday-Friday 3:00 PM - 7:30 PM.",
        audience: "both"
      })
    });
    const updated = await updateResponse.json();
    
    if (updateResponse.ok) {
      console.log(`✅ Updated Q&A pair`);
      console.log(`   New answer: ${updated.answer}`);
      console.log(`   New audience: ${updated.audience}\n`);
    } else {
      console.error('❌ Failed to update:', updated.error);
    }

    // 5. Test DELETE
    console.log(`5️⃣ Testing DELETE /api/qa-pairs/${created.id}`);
    const deleteResponse = await fetch(`${BASE_URL}/${created.id}`, {
      method: 'DELETE'
    });
    
    if (deleteResponse.ok) {
      console.log(`✅ Deleted Q&A pair\n`);
    } else {
      const deleteError = await deleteResponse.json();
      console.error('❌ Failed to delete:', deleteError.error);
    }

    console.log('✨ All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
testAPI();
