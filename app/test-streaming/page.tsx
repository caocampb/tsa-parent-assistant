"use client";

import { useState } from "react";

export default function TestStreaming() {
  const [question, setQuestion] = useState("How much does TSA cost?");
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");

  const testStreaming = async () => {
    setStreamedAnswer("");
    setError("");
    setIsStreaming(true);

    try {
      const response = await fetch('/api/q', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream' // This triggers streaming
        },
        body: JSON.stringify({ question })
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      // Handle the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('0:')) {
            // This is a text chunk from the AI SDK
            const content = line.slice(2).trim();
            if (content && content !== '"\n"') {
              // Remove quotes and parse
              try {
                const parsed = JSON.parse(content);
                setStreamedAnswer(prev => prev + parsed);
              } catch {
                // If not JSON, just append
                setStreamedAnswer(prev => prev + content);
              }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Test Streaming Response</h1>

      <div className="mb-4">
        <label className="block mb-2">Test Question:</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>

      <button
        onClick={testStreaming}
        disabled={isStreaming}
        className="mb-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {isStreaming ? 'Streaming...' : 'Test Streaming'}
      </button>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Streamed Answer:</h2>
        <div className="p-4 bg-gray-50 rounded-lg min-h-[200px]">
          {streamedAnswer || (isStreaming ? "Waiting for response..." : "No answer yet")}
          {isStreaming && <span className="animate-pulse">▊</span>}
        </div>
      </div>
    </div>
  );
}


