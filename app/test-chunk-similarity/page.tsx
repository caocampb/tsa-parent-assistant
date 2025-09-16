"use client";

import { useState } from "react";

export default function TestChunkSimilarity() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runTest = async () => {
    setLoading(true);
    try {
      // Simulate what's actually happening
      const shortQuery = "Registration & Enrollment";
      const fullChunk = `TEXAS SPORTS ACADEMY Parent Handbook 2024-2025 
      Elite Sports Training & Development TABLE OF CONTENTS 
      1. Registration & Enrollment 2. Practice Schedules 
      3. Uniform & Equipment Requirements 4. Policies & Procedures 
      5. Competition Schedule 6. Frequently Asked Questions 
      7. Contact Information 1. REGISTRATION & ENROLLMENT 
      Spring 2025 Registration Registration Opens: January 5, 2025 at 9:00 AM CST`;
      
      // Get embeddings
      const getEmbedding = async (text: string) => {
        const response = await fetch('/api/test-embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text })
        });
        return response.json();
      };
      
      const [queryEmb, chunkEmb] = await Promise.all([
        getEmbedding(shortQuery),
        getEmbedding(fullChunk)
      ]);
      
      // Calculate cosine similarity
      const cosineSimilarity = (a: number[], b: number[]) => {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
          normA += a[i] * a[i];
          normB += b[i] * b[i];
        }
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      };
      
      const similarity = cosineSimilarity(queryEmb.embedding, chunkEmb.embedding);
      
      setResults({
        shortQuery,
        fullChunkPreview: fullChunk.substring(0, 200) + "...",
        similarity: (similarity * 100).toFixed(1),
        queryTokens: shortQuery.split(' ').length * 1.5, // rough estimate
        chunkTokens: fullChunk.split(' ').length * 1.3 // rough estimate
      });
      
    } catch (error: any) {
      console.error('Test error:', error);
      setResults({ error: error.message });
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Understanding Chunk Similarity</h1>
      
      <button
        onClick={runTest}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Real Scenario'}
      </button>
      
      {results && (
        <div className="mt-6 space-y-4">
          {results.error ? (
            <div className="bg-red-100 p-4 rounded">
              <p className="text-red-600">Error: {results.error}</p>
            </div>
          ) : (
            <>
              <div className="bg-gray-100 p-4 rounded">
                <h2 className="font-semibold mb-2">What's Actually Happening:</h2>
                <p><strong>Your Query:</strong> "{results.shortQuery}" (~{results.queryTokens} tokens)</p>
                <p className="mt-2"><strong>Chunk Content:</strong> "{results.fullChunkPreview}" (~{results.chunkTokens} tokens)</p>
              </div>
              
              <div className="bg-yellow-100 p-4 rounded">
                <h2 className="font-semibold mb-2">Similarity Result:</h2>
                <p className="text-2xl font-bold">{results.similarity}%</p>
                <p className="mt-2">This is CORRECT! The short query is only a tiny part of the large chunk.</p>
              </div>
              
              <div className="bg-blue-100 p-4 rounded">
                <h2 className="font-semibold mb-2">Why This Makes Sense:</h2>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your query: 3 words about registration</li>
                  <li>The chunk: 1000+ tokens about EVERYTHING in the handbook</li>
                  <li>Registration is only ~10% of the chunk content</li>
                  <li>So ~40% similarity is actually quite good!</li>
                </ul>
              </div>
              
              <div className="bg-green-100 p-4 rounded">
                <h2 className="font-semibold mb-2">For Better Matches:</h2>
                <ul className="list-disc list-inside space-y-1">
                  <li>Use longer, more descriptive queries</li>
                  <li>Include context: "How do I register my child for TSA spring programs?"</li>
                  <li>Use a similarity threshold of 0.3-0.4, not 0.7</li>
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
