# Q&A API Implementation Plan

## Overview
Build the `/api/q` endpoint that connects our vector search to GPT and returns answers to parents.

## API Design

### Endpoint
```
POST /api/q
```

### Request Format
```json
{
  "question": "How much does TSA cost?"
}
```

### Response Format (Stripe-style)
```json
{
  "id": "q_1234567890",
  "question": "How much does TSA cost?",
  "answer": "TSA monthly tuition is $200/month, due on the 1st of each month...",
  "sources": [
    {
      "chunk_id": "chunk_123",
      "document_id": "doc_456",
      "content": "Fees & Payment Plans Monthly Tuition: $200/month...",
      "similarity": 0.42,
      "page_number": null
    }
  ],
  "confidence": 0.42,
  "created_at": "2025-09-16T20:00:00Z"
}
```

## Implementation Steps

### 1. Setup & Imports
- Vercel AI SDK for streaming
- OpenAI client for embeddings and chat
- Supabase client for vector search
- Zod for validation (prevents security issues from day 1)

### 2. Request Validation
- Validate question is non-empty string
- Validate question length (max 500 chars)
- Return 400 for invalid requests

### 3. Generate Embedding
```typescript
const embedding = await openai.embeddings.create({
  input: question,
  model: 'text-embedding-3-large',
  dimensions: 1536
});
```

### 4. Vector Search
```typescript
// Search both document chunks AND Q&A pairs
const chunks = await supabase.rpc('search_documents', {
  query_embedding: embedding.data[0].embedding,
  match_count: 7,  // Per architecture
  similarity_threshold: 0.3  // Per architecture (industry standard)
});

// V2: Also search qa_pairs table for direct matches
```

### 5. Check Confidence
- If best chunk < 0.3 similarity: Return "I don't know" response
- Log to `questions` table with low confidence
- V1: Single threshold for all questions
- V2: Adjust based on category (legal: 0.5, logistics: 0.3)

### 6. Prompt Engineering
```typescript
const systemPrompt = `You are a helpful assistant for Texas Sports Academy (TSA). 

CRITICAL RULES:
1. Answer ONLY using the provided context below
2. If the answer is not in the context, respond: "I don't have that information. Please contact the TSA office at (512) 555-0199."
3. Be clear and concise
4. Include ALL relevant details from the context (dates, times, costs, requirements)
5. If multiple chunks contain relevant info, synthesize them coherently`;

const userPrompt = `Context from TSA documents:
${chunks.map((chunk, i) => 
  `[Source ${i+1}]: ${chunk.content}`
).join('\n\n')}

Parent Question: ${question}

Answer:`;
```

### 7. Generate Answer
```typescript
// Using Vercel AI SDK for streaming
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',  // Will update to gpt-5-mini
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.1,  // Low for factual accuracy
  max_tokens: 500,   // Concise answers
  stream: true       // Enable streaming
});
```

### 8. Store in Database
```typescript
await supabase.from('questions').insert({
  question: question,
  answer: answer,
  sources: chunks.map(c => c.chunk_id),
  confidence: chunks[0]?.similarity || 0
});
```

### 9. Return Response
- Format response per API spec
- Include sources for transparency
- Add response headers for caching

## Architecture Alignment

✅ **Streaming**: Uses Vercel AI SDK  
✅ **Model**: GPT-4o-mini (ready for GPT-5-mini)  
✅ **Threshold**: 0.3 minimum confidence  
✅ **Retrieval**: Top 7 chunks  
✅ **Logging**: Stores in questions table  
✅ **Error Handling**: Graceful fallbacks  

## Performance Targets (from PRD)
- First token: < 1s ✅ (streaming masks latency)
- Complete answer: < 5s (warm) / < 10s (cold) ✅
- Search: < 100ms ✅ (pgvector HNSW)
- Real-world expectation: 5-7s average

## Error Handling
1. **No OpenAI key**: Return 500 with clear message
2. **No chunks found**: Return "I don't know" response
3. **Low confidence**: Include disclaimer in answer
4. **Rate limiting**: Return 429 with retry-after
5. **Timeout**: Return partial answer if possible

## Testing Strategy
1. Use `test-rag-evaluation` page
2. Must pass 8/10 test cases (80%)
3. Monitor response times
4. Check for required terms in answers

## Future Optimizations (V2)
- [ ] Cache top 20 questions
- [ ] Add query expansion
- [ ] Implement reranking
- [ ] Add follow-up suggestions
- [ ] Stream sources separately

## Security Considerations
- Validate all inputs
- Rate limit by IP (10 req/min)
- No PII in logs
- Sanitize responses

## Next Steps
1. Create `/api/q/route.ts`
2. Implement basic version (no streaming)
3. Add streaming support
4. Run evaluation tests
5. Optimize based on results
