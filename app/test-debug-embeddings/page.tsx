"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestDebugEmbeddings() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runDebugTest = async () => {
    setLoading(true);
    try {
      // Test 1: Generate embedding for a known string that should match
      const testQuery = "Registration & Enrollment";
      
      // Generate embedding for test query
      const response = await fetch('/api/test-embedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery })
      });
      
      const { embedding } = await response.json();
      
      // Test 2: Get a chunk directly and calculate similarity manually
      const { data: chunk } = await supabase
        .from('document_chunks')
        .select('content, embedding')
        .eq('chunk_index', 0)
        .single();
      
      // Test 3: Run the search function
      const { data: searchResults } = await supabase.rpc('search_documents', {
        query_embedding: embedding,
        match_count: 2,
        similarity_threshold: 0.0
      });
      
      setResults({
        testQuery,
        chunkContent: chunk?.content?.substring(0, 100) + '...',
        hasEmbedding: !!chunk?.embedding,
        embeddingType: typeof chunk?.embedding,
        searchResults
      });
      
    } catch (error: any) {
      console.error('Debug error:', error);
      setResults({ error: error.message });
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Embeddings</h1>
      
      <button
        onClick={runDebugTest}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Run Debug Test'}
      </button>
      
      {results && (
        <div className="mt-6 space-y-4">
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="font-semibold mb-2">Test Query:</h2>
            <p>{results.testQuery}</p>
          </div>
          
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="font-semibold mb-2">First Chunk:</h2>
            <p className="text-sm">{results.chunkContent}</p>
            <p className="text-sm mt-2">
              Has Embedding: {results.hasEmbedding ? '✅' : '❌'}<br/>
              Embedding Type: {results.embeddingType}
            </p>
          </div>
          
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="font-semibold mb-2">Search Results:</h2>
            {results.error ? (
              <p className="text-red-600">Error: {results.error}</p>
            ) : (
              <pre className="text-xs overflow-auto">
                {JSON.stringify(results.searchResults, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
