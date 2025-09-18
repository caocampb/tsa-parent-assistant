#!/bin/bash

echo "🧹 Cleaning up redundant test files..."

# Remove one-time scripts
rm -f scripts/populate-critical-qa.ts
rm -f scripts/populate-missing-qa.ts
rm -f scripts/add-missing-variations.ts
rm -f scripts/remove-bad-qa.ts
rm -f scripts/generate-qa-inserts.ts
rm -f scripts/diagnose-system.ts
rm -f scripts/split-workflowy-content.ts

# Remove experimental test pages
rm -rf app/test-foundation-proof
rm -rf app/test-rag-evaluation
rm -rf app/test-upload
rm -rf app/test-streaming
rm -rf app/test-view-chunks

# Remove test API routes if they exist
rm -rf app/api/test-qa
rm -rf app/api/test-stream
rm -rf app/api/test-embedding

echo "✅ Cleanup complete! Kept essential tests and utilities."
echo ""
echo "📁 Remaining test files:"
echo "  - scripts/test-real-parent-queries.ts (main integration test)"
echo "  - app/test-embeddings/page.tsx (debugging tool)"
echo "  - scripts/upload-documents.ts (content management)"
echo "  - scripts/insert-qa-pairs.ts (Q&A management)"
echo "  - scripts/list-qa-pairs.ts (Q&A auditing)"



