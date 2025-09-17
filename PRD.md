# TSA Assistant Bot

A Q&A system that helps both coaches and parents get instant, accurate answers about Texas Sports Academy.

## Problem

**For Coaches**: Complex partnership questions about starting schools (insurance, legal structure, costs) require lengthy calls.
**For Parents**: Staff spend **10+ hours/week** answering repetitive questions about schedules, fees, and logistics.

## Solution

AI chat that searches TSA documents and responds instantly. Available 24/7. No login required.

## How it works

1. **Parent asks:** "When is fall registration?"
2. **Bot searches** uploaded TSA documents  
3. **Bot responds:** "Fall registration opens June 1st (Source: Parent Handbook)"

If the answer isn't in the documents, bot says: *"I don't have that information."*

**Example Questions**

*Parent Questions:*
- "What time is practice for 7 year olds?"
- "Where do I buy uniforms?"
- "Can I carry over makeup classes?"

*Coach Questions:*
- "Is this a franchise?"
- "What insurance do I need?"
- "Can international students enroll with F-1 visas?"
- "How does the $15k tuition split work?"

**Zero Configuration** - Works out-of-the-box by recognizing universal patterns (schedules, policies, equipment lists) that every youth sports org shares.

## MVP Features

**Parent Interface**
- Clean chat at tsa-bot.vercel.app
- Mobile-first (parents in parking lots)
- No sign up
- 3-second response timeout
- Vercel/Linear design aesthetic (Geist font, clean spacing)

**Admin Panel** (for Lamar & Malekai)
- Upload PDFs, Word docs, audio files
- Add Q&A pairs directly (for edge cases)
- Delete outdated documents
- Password protected
- Tag content by audience (coach/parent)

## Out of scope
- User accounts
- Chat history persistence
- Analytics dashboard
- Multi-language (English only for MVP)
- Real-time notifications

## Technical Approach

```
TypeScript 5.6+ → End-to-end type safety
Next.js 15 (App Router) + shadcn/ui → Server Components, PPR, clean UI  
Tailwind CSS v4.1+ → Modern CSS with Oxide engine
Bun 1.2+ → Fast runtime, built-in test runner
Vercel AI SDK v5 → Streaming, tool calling, provider flexibility
OpenAI GPT-5-mini → Balance of performance & cost (gpt-5 for complex queries)
Supabase + pgvector → Document search (no separate vector DB needed)
Vercel → Zero-config deployment with Edge Functions
```

**Data Flow**
1. Upload PDF/Audio → Extract text/Transcribe → Generate embeddings → Store in pgvector
   - PDF: pdfjs-dist (more reliable than pdf-parse)
   - Audio: OpenAI Whisper API (alternative: Deepgram for speed)
   - Embeddings: text-embedding-3-small (1536 dimensions, $0.02/1M tokens)
2. User asks → Search vectors → Retrieve context → Stream response
   - Similarity search: pgvector with HNSW indexing
   - Context window: 8K tokens max
   - Streaming: Server-sent events via AI SDK

**Performance Targets**
- First response: < 200ms
- Complete answer: < 2s
- Search: < 100ms

## Success Metrics

- **Accuracy**: 
  - 95%+ on common questions (top 20)
  - 80%+ overall accuracy
  - 100% transparent about sources
- **Speed**: < 3 seconds per answer (< 7s for complex)
- **Impact**: 
  - 70% fewer repetitive questions
  - Clear escalation path for complex issues

## Timeline

**Day 1-2**: Chat interface  
**Day 3-4**: Document system  
**Day 5**: Testing & deploy

**Total: 1 week**

*Note: Working prototype in 10 minutes with starter code*

## Cost

- Build: 1 week
- Run: ~$50-100/month
  - OpenAI: $30-80 (GPT-5-mini: ~$0.10/1K questions)
  - Supabase: Free tier (up to 500MB vectors)
  - Vercel: Free tier (100GB bandwidth)
- Maintain: ~1 hour/month
- Scale: Linear with usage (no surprises)

**Why not:** Pinecone (overkill), LangChain (too complex), AWS (too heavy)

## Security & Privacy

- **Rate limiting**: 10 requests/minute per IP
- **Input sanitization**: Prevent prompt injection
- **Admin auth**: Secure password hashing (bcrypt)
- **HTTPS only**: Enforced at edge
- **No PII storage**: Questions deleted after response

## Architecture Patterns

- **Server Components**: UI renders on server (fast initial load)
- **Edge Functions**: API routes run closer to users
- **Streaming UI**: Progressive response rendering
- **Optimistic updates**: Instant feedback on uploads
- **Smart chunking**: Semantic document splitting (not fixed-size)

## What we need from TSA

1. **Documents** (5 minutes) - Any PDFs you give parents
2. **Contact info** (30 seconds) - Main office phone for fallback
3. **Domain choice** (30 seconds) - assistant.texassportsacademy.com or we provide

That's it. No meetings. No committees. Just ship it.

## Monitoring (Built-in)

- **Vercel Analytics**: Page views, response times
- **OpenAI Dashboard**: Token usage, costs
- **Supabase Dashboard**: Query performance
- **Error tracking**: Automatic via Vercel
- **Uptime**: 99.9% (Vercel SLA)

---

Simple solution to a real problem. Ready to build.