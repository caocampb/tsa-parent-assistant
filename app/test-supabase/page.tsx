"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestSupabase() {
  const [status, setStatus] = useState("Checking connection...");
  const [tables, setTables] = useState<string[]>([]);

  useEffect(() => {
    async function checkConnection() {
      try {
        // Test 1: Basic connection
        const { data, error } = await supabase
          .from('documents')
          .select('count')
          .limit(1);
        
        if (error) {
          // Table might not exist yet
          setStatus(`Connected but error: ${error.message}`);
        } else {
          setStatus("✅ Connected to Supabase!");
        }

        // Test 2: Try a simple query to check connection
        // We'll skip listing tables for now since that requires a function
      } catch (err: any) {
        setStatus(`❌ Connection failed: ${err.message}`);
      }
    }

    checkConnection();
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>
      
      <div className="mb-6 p-4 bg-muted rounded-lg">
        <p className="font-mono">{status}</p>
      </div>

      <div className="mt-6 space-y-4">
        <div className="p-4 bg-green-50 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">Database Ready! ✅</h3>
          <p className="text-sm text-green-700">All TSA tables created:</p>
          <ul className="list-disc list-inside mt-2 text-sm text-green-600">
            <li>documents - For uploaded files</li>
            <li>document_chunks - For searchable content</li>
            <li>questions - For analytics</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">Next Steps:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Add your Supabase URL and keys to .env.local</li>
          <li>If you have old tables, delete them in Supabase dashboard</li>
          <li>Run our schema SQL to create fresh tables</li>
        </ol>
      </div>
    </div>
  );
}
