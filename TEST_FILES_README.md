# Test Files Documentation

This repository maintains several test files for debugging and validating the RAG system. Each serves a specific purpose in the development workflow.

## Essential Test Files

### 📊 `/scripts/test-real-parent-queries.ts`
**Purpose**: Comprehensive end-to-end testing with realistic parent queries  
**When to use**: After any major change to validate overall system accuracy  
**Features**:
- 44 real-world parent questions across all categories
- Performance tracking (response times)
- Category-based success metrics
- Identifies slow queries (>5s)

### 🔍 `/app/test-embeddings/page.tsx`
**Purpose**: Interactive debugging tool for embeddings and search  
**When to use**: When investigating search quality issues  
**Features**:
- Test different queries against all audiences
- View raw similarity scores
- Compare chunks side-by-side
- Debug semantic vs keyword matching

## Root-Level Test Scripts

These are temporary diagnostic scripts created during debugging sessions:

- `test-rag-accuracy.ts` - Basic RAG accuracy testing
- `test-edge-cases.ts` - Edge case validation
- `test-overall-accuracy.ts` - Overall system accuracy metrics
- `test-content-based-queries.ts` - Content-specific query testing
- `test-chunk-retrieval.ts` - Chunk retrieval debugging
- `check-chunks.ts` / `check-all-chunks.ts` - Chunk inspection tools
- `diagnose-rag-issues.ts` - RAG diagnostic utilities

**Note**: Root-level test scripts are typically one-off debugging tools. Consider deleting after use or moving valuable ones to `/scripts`.

## Running Tests

```bash
# Run comprehensive parent query tests
npx tsx scripts/test-real-parent-queries.ts

# Use the embeddings UI (requires dev server)
npm run dev
# Navigate to http://localhost:3000/test-embeddings
```

## Best Practices

1. **Use `test-real-parent-queries.ts` as your primary validation tool**
2. **Create temporary test scripts at root level, move to `/scripts` if keeping**
3. **Document any new permanent test files in this README**
4. **Delete one-off debugging scripts after fixing issues**
