import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function testUpload() {
  console.log('🧪 Testing Document Upload System\n');

  const testFile = './test-content/test-parent-doc.txt';
  const fileContent = fs.readFileSync(testFile);
  
  // Test each audience
  const audiences = ['parent', 'coach', 'shared'] as const;
  
  for (const audience of audiences) {
    console.log(`\n📤 Uploading test document for ${audience.toUpperCase()}...`);
    
    const form = new FormData();
    form.append('file', fileContent, `test-${audience}-doc.txt`);
    form.append('audience', audience);
    
    try {
      const response = await fetch('http://localhost:3000/api/documents', {
        method: 'POST',
        body: form as any,
        headers: form.getHeaders()
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ Upload successful!`);
        console.log(`   ID: ${result.id}`);
        console.log(`   Chunks: ${result.chunk_count}`);
        console.log(`   Filename: ${result.filename}`);
      } else {
        console.log(`❌ Upload failed:`, result.error);
      }
    } catch (error) {
      console.log(`❌ Error:`, error);
    }
  }
  
  console.log('\n\n📊 Verifying uploads...');
  
  // Fetch all documents to verify
  try {
    const response = await fetch('http://localhost:3000/api/documents');
    const documents = await response.json();
    
    const testDocs = documents.filter((doc: any) => 
      doc.filename.startsWith('test-') && doc.filename.endsWith('-doc.txt')
    );
    
    console.log(`\nFound ${testDocs.length} test documents:`);
    testDocs.forEach((doc: any) => {
      console.log(`  - ${doc.filename} (${doc.audience}) - Uploaded: ${new Date(doc.uploaded_at).toLocaleString()}`);
    });
  } catch (error) {
    console.log('❌ Error fetching documents:', error);
  }
  
  console.log('\n✅ Test complete!');
}

// Make sure server is running
console.log('⚠️  Make sure the Next.js dev server is running (bun dev)');
console.log('   This test will upload documents via the API\n');

setTimeout(() => {
  testUpload().catch(console.error);
}, 2000);
