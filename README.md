# TSA Parent Assistant 🎾

A smart Q&A chatbot that helps parents and coaches get instant, accurate answers about Texas Sports Academy programs.

## What is this?

This is a RAG (Retrieval Augmented Generation) system that:
- 🔍 Searches through TSA documents (handbooks, schedules, policies)
- 💬 Answers parent questions like "What time is practice for 7-year-olds?"
- 📚 Shows source citations for trust and transparency
- ⚡ Responds in under 2 seconds

**Live at**: [Coming soon - tsa-assistant.vercel.app]

## Quick Start (5 minutes)

### 1. Clone and Install
```bash
git clone https://github.com/[your-org]/tsa-parent-assistant.git
cd tsa-parent-assistant
npm install
```

### 2. Set Up Environment Variables
Create a `.env.local` file:
```bash
# Get these from your team lead
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Run Development Server
```bash
npm run dev
```
Open http://localhost:3000 - you should see the chat interface!

## Project Structure

```
tsa-parent-assistant/
├── app/                      # Next.js app directory
│   ├── page.tsx             # Home page with search box
│   ├── q/[slug]/page.tsx    # Question/answer pages
│   └── api/                 # Backend endpoints
│       ├── q/route.ts       # Main Q&A endpoint (the brain!)
│       └── documents/       # Document upload handling
│
├── components/              # React components
│   ├── search/             # Search box and suggestions
│   ├── answer/             # Answer display components
│   └── ui/                 # Reusable UI components (buttons, cards)
│
├── lib/                    # Utilities
│   ├── supabase.ts        # Database connection
│   ├── prompts.ts         # AI system prompts
│   └── types.ts           # TypeScript types
│
├── scripts/               # Maintenance scripts
│   └── test-real-parent-queries.ts  # Test suite
│
└── sql/                   # Database migrations
    ├── rebuild-with-audiences.sql   # Base tables
    ├── add-hybrid-search.sql        # Search features
    └── fix-hybrid-search-types.sql  # Type fixes
```

## How It Works

### The Flow
1. **Parent asks**: "How much are monthly fees?"
2. **System searches** using both:
   - **Semantic search**: Understands "fees" = "tuition" = "cost"
   - **Keyword search**: Finds exact matches for "monthly"
3. **AI generates answer** from found documents
4. **Shows sources**: "According to the Parent Handbook (page 5)..."

### Key Components

#### 🧠 `/app/api/q/route.ts` - The Brain
This is where the magic happens:
- Takes user questions
- Searches Q&A pairs (instant answers for common questions)
- Falls back to RAG search (searching document chunks)
- Uses GPT-5-mini to generate answers

#### 📚 Database Schema
- **documents**: Uploaded PDFs/files
- **document_chunks**: Documents split into searchable pieces
- **qa_pairs**: Pre-written Q&A for common questions
- **questions**: Analytics on what users ask

#### 🔍 Hybrid Search
Combines two search methods:
- **70% Semantic**: Understanding meaning ("price" ≈ "cost")
- **30% Keyword**: Exact word matching
- Result: Better accuracy than either method alone

## Common Tasks

### Running Tests
```bash
# Test with real parent questions
npx tsx scripts/test-real-parent-queries.ts
```

### Debugging Search Quality
1. Go to http://localhost:3000/test-embeddings
2. Enter a test query
3. See what chunks are retrieved and their scores

### Adding Q&A Pairs
For frequently asked questions, add direct answers:
```sql
INSERT INTO qa_pairs (question, answer, audience) 
VALUES (
  'What are the office hours?',
  'Our office is open Monday-Friday 3:00 PM - 7:00 PM',
  'parent'
);
```

### Uploading Documents
1. Go to http://localhost:3000/admin
2. Upload PDFs or text files
3. System automatically chunks and indexes them

## Understanding the Code

### For New Developers

#### Start Here
1. **Read `/app/page.tsx`** - The home page UI
2. **Follow a search** - Trace from search box → API → response
3. **Understand `/app/api/q/route.ts`** - Core logic

#### Key Concepts
- **Embeddings**: Converting text to numbers for similarity search
- **Chunks**: Breaking documents into ~500 token pieces
- **Confidence Threshold**: Only show answers if similarity > 0.15
- **Streaming**: Sending response word-by-word for better UX

#### Common Patterns
```typescript
// Parallel searches for performance
const results = await Promise.all([
  searchQAPairs(query),
  searchDocuments(query)
]);

// Confidence checking
if (topScore < 0.15) {
  return "I don't have enough information..."
}

// Source tracking
chunks.map(chunk => ({
  content: chunk.content,
  source: `${chunk.filename} - Page ${chunk.page_number}`
}))
```

## Troubleshooting

### "No chunks found" errors
- Check if documents are uploaded
- Verify embeddings were generated
- Try lowering confidence threshold

### Slow responses (>5s)
- Check parallel vs sequential database calls
- Verify you're using `Promise.all`
- Consider caching common queries

### Wrong answers
- Review the chunks being retrieved
- Check if semantic search understands synonyms
- Consider adding Q&A pairs for common questions

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Environment Variables Needed
- `OPENAI_API_KEY` - For embeddings and chat
- `NEXT_PUBLIC_SUPABASE_URL` - Database URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Database public key

## Architecture Decisions

### Why These Choices?

**Next.js 15 + App Router**
- Server components = faster initial load
- Built-in API routes
- Easy Vercel deployment

**Supabase + pgvector**
- PostgreSQL = reliable
- Vector search built-in
- No separate vector DB needed

**GPT-5-mini**
- Best accuracy/cost balance
- Fast enough for real-time
- Handles follow-up questions well

**Hybrid Search**
- Semantic alone misses exact matches
- Keyword alone misses synonyms
- Together = 95%+ accuracy

## Getting Help

1. **Check test results**: `npx tsx scripts/test-real-parent-queries.ts`
2. **Debug with UI**: http://localhost:3000/test-embeddings
3. **Read the docs**: `ARCHITECTURE.md` for deep dives
4. **Ask the team**: We're here to help!

## Next Steps for New Devs

1. ✅ Get the app running locally
2. ✅ Try asking some questions
3. ✅ Read through `/app/api/q/route.ts`
4. ✅ Run the test suite
5. ✅ Make a small improvement (like adding a Q&A pair)

Welcome to the team! 🚀