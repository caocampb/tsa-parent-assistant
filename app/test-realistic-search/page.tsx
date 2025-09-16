"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestRealisticSearch() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [customQuery, setCustomQuery] = useState("");

  const testQueries = [
    { query: "how much does TSA cost", expected: "chunk 0" },
    { query: "what time is practice for 7 year old", expected: "chunk 0" },
    { query: "state championship dallas may", expected: "chunk 1" },
    { query: "contact lamar johnson email", expected: "chunk 1" },
    { query: "basketball training schedule", expected: "low scores" }
  ];

  const runTests = async () => {
    setLoading(true);
    try {
      const testResults = [];
      
      for (const test of testQueries) {
        // Generate embedding for query
        const response = await fetch('/api/test-embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: test.query })
        });
        
        const { embedding } = await response.json();
        
        // Search with different thresholds
        const searches = await Promise.all([
          supabase.rpc('search_documents', {
            query_embedding: embedding,
            match_count: 2,
            similarity_threshold: 0.0  // Get all results
          }),
          supabase.rpc('search_documents', {
            query_embedding: embedding,
            match_count: 2,
            similarity_threshold: 0.4  // Production threshold
          })
        ]);
        
        testResults.push({
          query: test.query,
          expected: test.expected,
          allResults: searches[0].data || [],
          filteredResults: searches[1].data || [],
          topScore: searches[0].data?.[0]?.similarity || 0
        });
      }
      
      setResults({ testResults });
      
    } catch (error: any) {
      console.error('Test error:', error);
      setResults({ error: error.message });
    }
    setLoading(false);
  };

  const runCustomQuery = async () => {
    if (!customQuery) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/test-embedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: customQuery })
      });
      
      const { embedding } = await response.json();
      
      const { data } = await supabase.rpc('search_documents', {
        query_embedding: embedding,
        match_count: 2,
        similarity_threshold: 0.0
      });
      
      setResults({
        customResults: {
          query: customQuery,
          results: data || []
        }
      });
      
    } catch (error: any) {
      setResults({ error: error.message });
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Realistic Parent Query Tests</h1>
      
      <div className="mb-8">
        <button
          onClick={runTests}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Run All Tests'}
        </button>
      </div>

      {results?.testResults && (
        <div className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">Test Results:</h2>
          {results.testResults.map((test: any, idx: number) => (
            <div key={idx} className="border rounded p-4">
              <p className="font-semibold">Query: "{test.query}"</p>
              <p className="text-sm text-gray-600">Expected: {test.expected}</p>
              
              <div className="mt-2">
                <p className="text-sm">Top match: <strong>{(test.topScore * 100).toFixed(1)}%</strong></p>
                {test.allResults.map((result: any, i: number) => (
                  <div key={i} className="ml-4 text-sm">
                    Chunk {result.chunk_index}: {(result.similarity * 100).toFixed(1)}%
                    {test.filteredResults.find((r: any) => r.chunk_id === result.chunk_id) ? 
                      ' ✅ (passes 0.4 threshold)' : ' ❌ (below 0.4 threshold)'}
                  </div>
                ))}
              </div>
              
              <div className={`mt-2 text-sm ${test.topScore >= 0.4 ? 'text-green-600' : 'text-red-600'}`}>
                {test.topScore >= 0.4 ? '✅ Would return answer' : '❌ Would say "I don\'t know"'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-6">
        <h2 className="text-xl font-semibold mb-4">Try Your Own Query:</h2>
        <div className="flex space-x-2">
          <input
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="Ask a parent question..."
            className="flex-1 p-2 border rounded"
          />
          <button
            onClick={runCustomQuery}
            disabled={loading || !customQuery}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            Search
          </button>
        </div>
      </div>

      {results?.customResults && (
        <div className="mt-4 border rounded p-4">
          <p className="font-semibold">Query: "{results.customResults.query}"</p>
          {results.customResults.results.map((result: any, i: number) => (
            <div key={i} className="mt-2">
              <p>Chunk {result.chunk_index}: <strong>{(result.similarity * 100).toFixed(1)}%</strong></p>
              <p className="text-sm text-gray-600">{result.content.substring(0, 100)}...</p>
            </div>
          ))}
        </div>
      )}

      {results?.error && (
        <div className="mt-4 bg-red-100 p-4 rounded">
          <p className="text-red-600">Error: {results.error}</p>
        </div>
      )}
    </div>
  );
}
