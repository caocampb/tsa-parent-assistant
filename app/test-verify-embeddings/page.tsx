"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestVerifyEmbeddings() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runVerification = async () => {
    setLoading(true);
    try {
      // Step 1: Get a chunk from database
      const { data: chunk, error } = await supabase
        .from('document_chunks')
        .select('id, content, embedding')
        .eq('chunk_index', 0)
        .single();
      
      if (error) throw error;
      
      // Step 2: Generate a fresh embedding for the same content
      const response = await fetch('/api/test-embedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: chunk.content })
      });
      
      const freshEmbed = await response.json();
      
      // Step 3: Compare stored vs fresh embedding
      // Note: Supabase returns embeddings as strings, we need to parse
      let storedArray: number[] = [];
      if (typeof chunk.embedding === 'string') {
        // Parse the string representation
        storedArray = JSON.parse(chunk.embedding);
      } else if (Array.isArray(chunk.embedding)) {
        storedArray = chunk.embedding;
      }
      
      // Calculate similarity between stored and fresh
      const cosineSimilarity = (a: number[], b: number[]) => {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
          dotProduct += a[i] * b[i];
          normA += a[i] * a[i];
          normB += b[i] * b[i];
        }
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      };
      
      const similarity = cosineSimilarity(storedArray, freshEmbed.embedding);
      
      // Step 4: Test a manual pgvector query
      const { data: manualSearch } = await supabase.rpc('search_documents', {
        query_embedding: freshEmbed.embedding,
        match_count: 1,
        similarity_threshold: 0.0
      });
      
      setResults({
        chunkId: chunk.id,
        contentPreview: chunk.content.substring(0, 100) + '...',
        storedDimensions: storedArray.length,
        freshDimensions: freshEmbed.dimensions,
        storedEmbeddingType: typeof chunk.embedding,
        similarityToFresh: (similarity * 100).toFixed(1),
        manualSearchResult: manualSearch?.[0],
        diagnosis: similarity > 0.99 ? 'Embeddings match perfectly!' : 'PROBLEM: Embeddings don\'t match!'
      });
      
    } catch (error: any) {
      console.error('Verification error:', error);
      setResults({ error: error.message });
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Verify Embedding Storage</h1>
      
      <p className="mb-4 text-gray-600">
        This test will verify that embeddings are stored correctly in Supabase
        by comparing stored embeddings with freshly generated ones.
      </p>
      
      <button
        onClick={runVerification}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Verifying...' : 'Run Verification'}
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
                <h2 className="font-semibold mb-2">Chunk Details:</h2>
                <p>ID: {results.chunkId}</p>
                <p>Content: "{results.contentPreview}"</p>
              </div>
              
              <div className="bg-blue-100 p-4 rounded">
                <h2 className="font-semibold mb-2">Embedding Comparison:</h2>
                <p>Stored dimensions: {results.storedDimensions}</p>
                <p>Fresh dimensions: {results.freshDimensions}</p>
                <p>Storage type: {results.storedEmbeddingType}</p>
                <p className="mt-2 font-semibold">
                  Similarity: {results.similarityToFresh}%
                </p>
              </div>
              
              <div className={`p-4 rounded ${results.similarityToFresh > 99 ? 'bg-green-100' : 'bg-red-100'}`}>
                <h2 className="font-semibold mb-2">Diagnosis:</h2>
                <p className="text-lg">{results.diagnosis}</p>
              </div>
              
              <div className="bg-gray-100 p-4 rounded">
                <h2 className="font-semibold mb-2">Manual Search Test:</h2>
                {results.manualSearchResult ? (
                  <>
                    <p>Found chunk: {results.manualSearchResult.chunk_id}</p>
                    <p>Similarity: {(results.manualSearchResult.similarity * 100).toFixed(1)}%</p>
                  </>
                ) : (
                  <p>No results from manual search</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
