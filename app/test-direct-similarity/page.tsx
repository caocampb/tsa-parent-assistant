"use client";

import { useState } from "react";

export default function TestDirectSimilarity() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runTest = async () => {
    setLoading(true);
    try {
      // Test 1: Get embeddings for identical text
      const text1 = "Registration & Enrollment";
      const text2 = "Registration & Enrollment"; // Exact same
      const text3 = "How to register for spring sports";
      const text4 = "Weather forecast for tomorrow";
      
      // Get embeddings
      const getEmbedding = async (text: string) => {
        const response = await fetch('/api/test-embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text })
        });
        return response.json();
      };
      
      const [emb1, emb2, emb3, emb4] = await Promise.all([
        getEmbedding(text1),
        getEmbedding(text2),
        getEmbedding(text3),
        getEmbedding(text4)
      ]);
      
      // Calculate cosine similarity manually
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
      
      const similarity_identical = cosineSimilarity(emb1.embedding, emb2.embedding);
      const similarity_related = cosineSimilarity(emb1.embedding, emb3.embedding);
      const similarity_unrelated = cosineSimilarity(emb1.embedding, emb4.embedding);
      
      setResults({
        text1,
        text2,
        text3,
        text4,
        similarity_identical: (similarity_identical * 100).toFixed(1),
        similarity_related: (similarity_related * 100).toFixed(1),
        similarity_unrelated: (similarity_unrelated * 100).toFixed(1),
        dimensions: emb1.dimensions
      });
      
    } catch (error: any) {
      console.error('Test error:', error);
      setResults({ error: error.message });
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Direct Similarity</h1>
      
      <button
        onClick={runTest}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Run Similarity Test'}
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
                <h2 className="font-semibold mb-2">Test Texts:</h2>
                <p>1. "{results.text1}"</p>
                <p>2. "{results.text2}" (identical)</p>
                <p>3. "{results.text3}" (related)</p>
                <p>4. "{results.text4}" (unrelated)</p>
              </div>
              
              <div className="bg-green-100 p-4 rounded">
                <h2 className="font-semibold mb-2">Similarity Scores:</h2>
                <p>Identical text (1 vs 2): <strong>{results.similarity_identical}%</strong> (should be ~100%)</p>
                <p>Related text (1 vs 3): <strong>{results.similarity_related}%</strong> (should be 70-85%)</p>
                <p>Unrelated text (1 vs 4): <strong>{results.similarity_unrelated}%</strong> (should be &lt;40%)</p>
              </div>
              
              <div className="bg-blue-100 p-4 rounded">
                <p>Embedding dimensions: {results.dimensions}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
