"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function TestEmbeddings() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>("");
  const [chunks, setChunks] = useState<any[]>([]);
  const [testQuery, setTestQuery] = useState("What is the schedule?");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .order('uploaded_at', { ascending: false });
    setDocuments(data || []);
  };

  const loadChunks = async (docId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('document_id', docId)
      .order('chunk_index');
    
    if (error) {
      console.error('Error loading chunks:', error);
    } else {
      setChunks(data || []);
    }
    setLoading(false);
  };

  const testSimilaritySearch = async () => {
    if (!testQuery) return;
    
    setLoading(true);
    try {
      // Generate embedding for the query
      const response = await fetch('/api/test-embedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery })
      });
      
      const { embedding, dimensions } = await response.json();
      
      // Now search for similar chunks
      const { data: searchResults, error } = await supabase.rpc('search_documents', {
        query_embedding: embedding,
        match_count: 5,
        similarity_threshold: 0.0
      });
      
      if (error) {
        console.error('Search error:', error);
        setSearchResults([{
          type: 'error',
          message: `Search failed: ${error.message}`
        }]);
      } else {
        setSearchResults(searchResults || []);
      }
    } catch (error: any) {
      console.error('Error:', error);
      setSearchResults([{
        type: 'error',
        message: `Failed: ${error.message}`
      }]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Embedding Verification Tool</h1>
        
        {/* Document Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">1. Select a Document</h2>
          <select
            value={selectedDoc}
            onChange={(e) => {
              setSelectedDoc(e.target.value);
              if (e.target.value) loadChunks(e.target.value);
            }}
            className="w-full p-2 border rounded-md"
          >
            <option value="">Choose a document...</option>
            {documents.map(doc => (
              <option key={doc.id} value={doc.id}>
                {doc.filename} ({doc.doc_type})
              </option>
            ))}
          </select>
        </div>

        {/* Chunk Inspector */}
        {selectedDoc && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              2. Verify Embeddings ({chunks.length} chunks)
            </h2>
            
            {loading ? (
              <p>Loading chunks...</p>
            ) : (
              <div className="space-y-3">
                {chunks.slice(0, 5).map((chunk, idx) => (
                  <div key={chunk.id} className="border rounded p-3">
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">Chunk {chunk.chunk_index}</span>
                      <span className="text-sm text-gray-600">
                        {chunk.embedding ? '✅ Has Embedding' : '❌ No Embedding'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      {chunk.content.substring(0, 100)}...
                    </p>
                    {chunk.embedding && (
                      <div className="bg-gray-50 p-2 rounded text-xs">
                        <p className="font-mono">
                          Embedding: ✅ Stored (vector type)
                        </p>
                        <p className="mt-1">
                          {typeof chunk.embedding === 'string' && chunk.embedding.startsWith('[') ? 
                            `Preview: ${chunk.embedding.substring(0, 50)}...` : 
                            'Vector data present'}
                        </p>
                      </div>
                    )}
                    {chunk.page_number && (
                      <p className="text-xs text-gray-500 mt-1">Page: {chunk.page_number}</p>
                    )}
                    {chunk.audio_timestamp && (
                      <p className="text-xs text-gray-500 mt-1">
                        Timestamp: {Math.floor(chunk.audio_timestamp / 60)}:{Math.floor(chunk.audio_timestamp % 60).toString().padStart(2, '0')}
                      </p>
                    )}
                  </div>
                ))}
                {chunks.length > 5 && (
                  <p className="text-sm text-gray-500">
                    ... and {chunks.length - 5} more chunks
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Similarity Search Test */}
        {selectedDoc && chunks.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              3. Test Similarity Search
            </h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Enter a test query..."
                className="flex-1 p-2 border rounded-md"
              />
              <button
                onClick={testSimilaritySearch}
                disabled={loading}
                className="px-4 py-2 bg-tsa-blue text-white rounded-md hover:bg-tsa-blue/90 disabled:opacity-50"
              >
                Search
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">Search Results:</h3>
                {searchResults[0].type === 'error' ? (
                  <div className="border rounded p-4 bg-red-50">
                    <p className="text-red-800">{searchResults[0].message}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      Found {searchResults.length} similar chunks for "{testQuery}":
                    </p>
                    {searchResults.map((result: any, idx: number) => (
                      <div key={result.chunk_id || idx} className="border rounded p-4 hover:bg-gray-50">
                        <div className="flex justify-between mb-2">
                          <span className="font-medium text-tsa-blue">
                            Match #{idx + 1} - Chunk {result.chunk_index}
                          </span>
                          <span className="text-sm font-semibold text-green-600">
                            {(result.similarity * 100).toFixed(1)}% similar
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">
                          {result.content.substring(0, 200)}...
                        </p>
                        {result.page_number && (
                          <p className="text-xs text-gray-500">Page: {result.page_number}</p>
                        )}
                        {result.audio_timestamp && (
                          <p className="text-xs text-gray-500">
                            Time: {Math.floor(result.audio_timestamp / 60)}:{(result.audio_timestamp % 60).toFixed(0).padStart(2, '0')}
                          </p>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
