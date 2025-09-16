"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function TestUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [documents, setDocuments] = useState<any[]>([]);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  // Load existing documents
  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('uploaded_at', { ascending: false });
    
    if (data) setDocuments(data);
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setError("");
    setResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Add idempotency key based on filename
      const idempotencyKey = `${file.name}-${file.size}`;
      
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      
      setResult(data);
      loadDocuments(); // Refresh list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Document Upload Test</h1>
      
      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Upload Document</h2>
        
        <div className="space-y-4">
          <div>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.mp3,.wav"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            <p className="mt-1 text-sm text-gray-500">
              Supports: PDF, DOCX, TXT, MP3, WAV
            </p>
          </div>
          
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        
        {/* Results */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
            Error: {error}
          </div>
        )}
        
        {result && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold text-green-800">Success!</h3>
            <pre className="mt-2 text-sm text-green-700">
              {JSON.stringify(result, null, 2)}
            </pre>
            {result.embeddings_generated && (
              <p className="mt-3 text-sm font-medium text-green-700">
                ✅ Embeddings generated for all {result.chunk_count} chunks!
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Documents List */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Uploaded Documents</h2>
          <button
            onClick={loadDocuments}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Refresh
          </button>
        </div>
        
        {documents.length === 0 ? (
          <p className="text-gray-500">No documents uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{doc.filename}</p>
                  <p className="text-sm text-gray-500">
                    Type: {doc.doc_type} • Uploaded: {new Date(doc.uploaded_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
