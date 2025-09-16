"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function TestViewChunks() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [chunks, setChunks] = useState<any[]>([]);
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
    setSelectedDoc(docId);
    
    const { data } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('document_id', docId)
      .order('chunk_index');
    
    setChunks(data || []);
    setLoading(false);
  };

  const searchInChunks = (searchTerm: string) => {
    return chunks.map((chunk, idx) => {
      const content = chunk.content.toLowerCase();
      const term = searchTerm.toLowerCase();
      const found = content.includes(term);
      return { ...chunk, found, index: idx };
    });
  };

  const costRelatedChunks = searchInChunks('$');
  const tuitionChunks = searchInChunks('tuition');
  const feeChunks = searchInChunks('fee');

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">View Full Chunk Content</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Select Document:</h2>
        <div className="space-y-2">
          {documents.map(doc => (
            <button
              key={doc.id}
              onClick={() => loadChunks(doc.id)}
              className={`p-3 border rounded w-full text-left ${
                selectedDoc === doc.id ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'
              }`}
            >
              {doc.filename} ({doc.chunk_count} chunks)
            </button>
          ))}
        </div>
      </div>

      {loading && <p>Loading chunks...</p>}

      {chunks.length > 0 && (
        <div className="space-y-6">
          <div className="bg-yellow-100 p-4 rounded">
            <h3 className="font-semibold mb-2">Quick Search Results:</h3>
            <p>Chunks containing "$": {costRelatedChunks.filter(c => c.found).map(c => `Chunk ${c.index}`).join(', ') || 'None'}</p>
            <p>Chunks containing "tuition": {tuitionChunks.filter(c => c.found).map(c => `Chunk ${c.index}`).join(', ') || 'None'}</p>
            <p>Chunks containing "fee": {feeChunks.filter(c => c.found).map(c => `Chunk ${c.index}`).join(', ') || 'None'}</p>
          </div>

          <h2 className="text-lg font-semibold">All Chunks:</h2>
          {chunks.map((chunk, idx) => {
            const hasCost = chunk.content.includes('$');
            const hasTuition = chunk.content.toLowerCase().includes('tuition');
            const hasFee = chunk.content.toLowerCase().includes('fee');
            
            return (
              <div key={chunk.id} className="border rounded p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">Chunk {idx}</h3>
                  <div className="text-sm space-x-2">
                    {hasCost && <span className="bg-green-200 px-2 py-1 rounded">Has $</span>}
                    {hasTuition && <span className="bg-blue-200 px-2 py-1 rounded">Has Tuition</span>}
                    {hasFee && <span className="bg-purple-200 px-2 py-1 rounded">Has Fee</span>}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {chunk.content}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Tokens: ~{Math.round(chunk.content.length / 4)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
