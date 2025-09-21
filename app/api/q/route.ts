import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { streamText, generateObject, createUIMessageStream, createUIMessageStreamResponse, convertToModelMessages } from 'ai';
import { z } from 'zod';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { getSystemPrompt, getQAPrompt } from '@/lib/prompts';

/**
 * GPT-5-mini Optimized Implementation:
 * - Always use gpt-5-mini for consistent fast responses
 * - Low reasoning effort for speed
 * - Handles 95%+ of parent queries effectively
 * 
 * Performance: ~5s average (down from 25s with gpt-5)
 */

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

// Query expansion to catch variations
function generateQueryVariations(question: string): string[] {
  const variations = [question];
  
  // Remove punctuation variation
  const noPunctuation = question.replace(/[?!.]$/, '');
  if (noPunctuation !== question) variations.push(noPunctuation);
  
  // Synonym expansion for common terms
  const synonyms: Record<string, string[]> = {
    'charges': ['fees', 'costs', 'charges'],
    'charge': ['fee', 'cost', 'charge'],
    'pricing': ['cost', 'fee', 'price', 'pricing'],
    'price': ['cost', 'fee', 'pricing', 'price'],
    'payment': ['tuition', 'fee', 'payment'],
    'amount': ['cost', 'fee', 'price', 'amount'],
    'phone number': ['phone', 'contact', 'call'],
    'number': ['phone', 'contact'],
    // Critical terms for TSA
    'dash': ['Dash system', 'Dash', 'dashboard', 'parent portal'],
    'map': ['MAP test', 'MAP testing', 'MAP assessment'],
    'homework': ['assignments', 'home work', 'hw']
  };
  
  // Generate variations with synonyms
  for (const [word, syns] of Object.entries(synonyms)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(question)) {
      for (const syn of syns) {
        if (syn !== word) {
          const expanded = question.replace(regex, syn);
          if (!variations.includes(expanded)) {
            variations.push(expanded);
          }
        }
      }
    }
  }
  
  // Common rephrasing patterns - expanded for better coverage
  const replacements = [
    [/how much does (.*) cost/i, 'what is the cost of $1'],
    [/what's/i, 'what is'],
    [/what're/i, 'what are'],
    [/i'm/i, 'i am'],
    [/tell me all/i, 'what are all'],
    [/tell me about/i, 'what is'],
    [/tell me the/i, 'what is the'],
    [/can you tell me/i, 'what is'],
    [/could you tell me/i, 'what is'],
    [/i need to know/i, 'what is'],
    [/do you know/i, 'what is'],
    [/please explain/i, 'what is'],
    [/^how much\??$/i, 'how much does TSA cost'],  // Handle "how much??"
    [/my kid is (\d+)/i, 'my $1 year old'],         // "My kid is 7" → "my 7 year old"
  ];
  
  for (const [pattern, replacement] of replacements) {
    const rephrased = question.replace(pattern, replacement as string);
    if (rephrased !== question && !variations.includes(rephrased)) {
      variations.push(rephrased);
    }
  }
  
  // Limit variations to reduce API calls
  return [...new Set(variations)].slice(0, 3);
}

// Categorize questions for better fallback responses
function categorizeQuestion(question: string): string {
  const lowerQuestion = question.toLowerCase();
  
  if (lowerQuestion.match(/pay|credit|check|cash|billing|invoice/)) return 'payment';
  if (lowerQuestion.match(/schedule|time|when|hours|pickup|drop/)) return 'schedule';
  if (lowerQuestion.match(/cost|price|fee|charge|refund|discount/)) return 'pricing';
  if (lowerQuestion.match(/insurance|liability|coverage/)) return 'insurance';
  if (lowerQuestion.match(/space|facility|location|building/)) return 'facility';
  if (lowerQuestion.match(/swim|pool|basketball|sport/)) return 'sports';
  
  return 'general';
}

// Smart fallback messages based on question category
function getFallbackMessage(question: string, audience: string): string {
  const category = categorizeQuestion(question);
  const contactInfo = "Please contact TSA at (512) 555-0199";
  
  const fallbacks = {
    payment: `For payment method options and billing questions, ${contactInfo} or email billing@texassportsacademy.com.`,
    schedule: `For specific schedule and timing questions, please check with ${audience === 'parent' ? 'your coach or the front desk' : 'the TSA operations team'} at (512) 555-0199.`,
    pricing: `For detailed pricing and fee information, ${contactInfo} to speak with our enrollment team.`,
    insurance: `For insurance requirements and coverage details, ${contactInfo} or email info@texassportsacademy.com.`,
    facility: `For facility and space requirements, please contact our real estate team at (512) 555-0199.`,
    sports: `For information about specific sports programs and activities, ${contactInfo}.`,
    general: `I don't have that specific information. ${contactInfo}.`
  };
  
  return fallbacks[category as keyof typeof fallbacks] || fallbacks.general;
}

// Calculate keyword overlap between question and chunk content
function calculateKeywordOverlap(question: string, content: string): number {
  // Extract important keywords (3+ chars, not common words)
  const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'for', 'with', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once']);
  
  const getKeywords = (text: string) => {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 3 && !stopWords.has(word));
  };
  
  const questionKeywords = new Set(getKeywords(question));
  const contentKeywords = getKeywords(content);
  const contentKeywordsSet = new Set(contentKeywords);
  
  // Count overlapping keywords
  let overlap = 0;
  for (const keyword of questionKeywords) {
    if (contentKeywordsSet.has(keyword)) {
      overlap++;
    }
  }
  
  // Return normalized score (0-1)
  return questionKeywords.size > 0 ? overlap / questionKeywords.size : 0;
}

// Schema for follow-up questions
const followUpQuestionsSchema = z.object({
  questions: z.array(z.string()).length(3).describe('Exactly 3 follow-up questions')
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Handle AI SDK format (messages array) or direct question
  let rawQuestion: string;
  let providedAudience: string;
  
  if (body.messages && Array.isArray(body.messages)) {
    // AI SDK v5 format - get the last user message
    const lastUserMessage = body.messages.filter((m: any) => m.role === 'user').pop();
    // Extract text from parts array (AI SDK v5 format)
    if (lastUserMessage?.parts) {
      const textPart = lastUserMessage.parts.find((p: any) => p.type === 'text');
      rawQuestion = textPart?.text || '';
    } else {
      // Fallback to content for older format
      rawQuestion = lastUserMessage?.content || '';
    }
    providedAudience = body.audience || 'parent';
  } else {
    // Direct format
    rawQuestion = body.question || '';
    providedAudience = body.audience || 'parent';
  }
  
  if (!rawQuestion) {
    return NextResponse.json(
      { error: 'Question is required' },
      { status: 400 }
    );
  }
  
  // Sanitize input for consistent embeddings
  const question = rawQuestion
    .trim()                           // Remove leading/trailing spaces
    .replace(/\s+/g, ' ')            // Normalize multiple spaces
    .replace(/[?!.]+$/, '?');        // Normalize ending punctuation
  
  // Always stream responses
  
  // 1. Use provided audience (default to 'parent' if not provided)
  const audience = (providedAudience === 'coach' ? 'coach' : 'parent') as 'parent' | 'coach';

  // 2. Add audience context to the question for better embedding
  const contextualQuestion = audience === 'coach'
    ? `Coach asking about business operations: ${question}`
    : `Parent asking about their child's program: ${question}`;

  // 3. Generate embeddings for query variations
  const queryVariations = generateQueryVariations(question);
  const embeddings = await Promise.all(
    queryVariations.map(q => 
      openaiClient.embeddings.create({
        input: q,
        model: 'text-embedding-3-large',
        dimensions: 1536
      })
    )
  );
  
  // 4. HYBRID APPROACH: First check Q&A pairs with all query variations
  let bestQAMatch = null;
  let bestQASimilarity = 0;
  
  // PARALLEL Q&A searches for all embeddings
  const qaSearchPromises = embeddings.map(embedding => 
    supabase.rpc('search_qa_pairs', {
      query_embedding: embedding.data[0].embedding,
      match_count: 1,
      similarity_threshold: 0.75,
      filter_audience: audience
    })
  );
  
  const qaResults = await Promise.all(qaSearchPromises);
  
  // Find the best match from all results
  for (const { data: qaPairs, error } of qaResults) {
    if (qaPairs && qaPairs.length > 0 && qaPairs[0].similarity > bestQASimilarity) {
      bestQAMatch = qaPairs[0];
      bestQASimilarity = qaPairs[0].similarity;
    }
  }
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('Q&A Search Debug:', {
      question,
      audience,
      queryVariations: queryVariations.length,
      bestQAMatch: bestQAMatch ? {
        question: bestQAMatch.question,
        similarity: bestQAMatch.similarity,
        audience: bestQAMatch.audience
      } : null,
      willUseQA: bestQAMatch && bestQAMatch.similarity >= 0.75,
      ragFallback: !bestQAMatch || bestQAMatch.similarity < 0.75
    });
  }
  
  // If we have a Q&A match above our search threshold, use it
  if (bestQAMatch && bestQAMatch.similarity >= 0.75) {
    const qaAnswer = bestQAMatch.answer;
    
    // Create a UI message stream for Q&A response
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Build messages array with conversation history if available
        const messages = [];
        
        // Add system prompt
        messages.push({
          role: 'system' as const,
          content: getQAPrompt()
        });
        
        // If we have conversation history, convert and include it
        if (body.messages && Array.isArray(body.messages)) {
          const historicalMessages = convertToModelMessages(body.messages.slice(0, -1)); // All but the last message
          messages.push(...historicalMessages);
        }
        
        // Add the Q&A answer
        messages.push({
          role: 'user' as const,
          content: qaAnswer
        });
        
        // Stream the Q&A answer
        const result = streamText({
          model: openai('gpt-5-mini'),
          messages,
          providerOptions: {
            openai: {
              reasoning_effort: 'minimal',
              textVerbosity: 'low'
            }
          },
          onFinish: async () => {
            // After streaming completes, generate follow-up questions
            const conversationContext = body.messages && Array.isArray(body.messages) 
              ? `Previous conversation:\n${body.messages.map((m: any) => 
                  `${m.role}: ${m.parts?.find((p: any) => p.type === 'text')?.text || m.content || ''}`
                ).join('\n')}\n\n`
              : '';
              
            const { object } = await generateObject({
              model: openai('gpt-5-mini'),
              schema: followUpQuestionsSchema,
              prompt: `${conversationContext}Based on this TSA Q&A exchange:
Question: "${question}"
Answer: "${qaAnswer}"

Generate 3 relevant follow-up questions that a parent might ask next about TSA. Don't repeat questions that were already asked in the conversation.`,
            });
            
            // Write follow-up questions as a data part
            writer.write({
              type: 'data-followups',
              id: 'followups-1',
              data: object,
            });
          },
        });
        
        // Merge the text stream
        writer.merge(result.toUIMessageStream());
      },
    });
    
    return createUIMessageStreamResponse({ stream });
  }
  
  // 5. Fall back to RAG: Use hybrid search for better accuracy
  // Determine if hybrid search is available (check if the new functions exist)
  const useHybridSearch = true; // Set to false if migration hasn't been run yet
  
  console.log('RAG Search Debug:', {
    useHybridSearch,
    question,
    audience
  });
  
  // Search the appropriate audience-specific table
  const searchFunction = audience === 'coach' 
    ? (useHybridSearch ? 'hybrid_search_documents_coach' : 'search_documents_coach')
    : (useHybridSearch ? 'hybrid_search_documents_parent' : 'search_documents_parent');
  
  const sharedSearchFunction = useHybridSearch ? 'hybrid_search_documents_shared' : 'search_documents_shared';
  
  // Search with all embeddings and combine results
  const allChunks = [];
  
  // PARALLEL RAG searches for all embeddings
  const ragSearchPromises = embeddings.map(async (embedding) => {
    // For hybrid search, we pass both the embedding and the text
    const searchParams = useHybridSearch
      ? {
          query_embedding: embedding.data[0].embedding,
          query_text: question, // Original question text for keyword matching
          similarity_threshold: 0.2, // Lower threshold since hybrid compensates
          match_count: 2,
          semantic_weight: 0.7 // 70% semantic, 30% keyword
        }
      : {
          query_embedding: embedding.data[0].embedding,
          match_count: 2,
          similarity_threshold: 0.4
        };
    
    const sharedSearchParams = useHybridSearch
      ? {
          query_embedding: embedding.data[0].embedding,
          query_text: question,
          similarity_threshold: 0.3,
          match_count: 1,
          semantic_weight: 0.7
        }
      : {
          query_embedding: embedding.data[0].embedding,
          match_count: 1,
          similarity_threshold: 0.4
        };
    
    const [audienceResult, sharedResult] = await Promise.all([
      supabase.rpc(searchFunction, searchParams),
      supabase.rpc(sharedSearchFunction, sharedSearchParams)
    ]);
    
    // Check for errors
    if (audienceResult.error) {
      console.error('Hybrid search error (audience):', audienceResult.error);
      // Fall back to regular search if hybrid fails
      if (useHybridSearch) {
        const fallbackResult = await supabase.rpc(
          audience === 'coach' ? 'search_documents_coach' : 'search_documents_parent',
          {
            query_embedding: embedding.data[0].embedding,
            match_count: 2,
            similarity_threshold: 0.4
          }
        );
        return [...(fallbackResult.data || [])];
      }
      return [];
    } else {
      const audienceChunks = audienceResult.data || [];
      
      // Handle shared results
      if (sharedResult.error) {
        console.error('Hybrid search error (shared):', sharedResult.error);
        // Fall back to regular search if hybrid fails
        if (useHybridSearch) {
          const fallbackResult = await supabase.rpc('search_documents_shared', {
            query_embedding: embedding.data[0].embedding,
            match_count: 1,
            similarity_threshold: 0.4
          });
          return [...audienceChunks, ...(fallbackResult.data || [])];
        }
        return audienceChunks;
      } else {
        return [...audienceChunks, ...(sharedResult.data || [])];
      }
    }
  });
  
  // Wait for all parallel searches to complete
  const allSearchResults = await Promise.all(ragSearchPromises);
  
  // Flatten all results into a single array
  for (const chunks of allSearchResults) {
    allChunks.push(...chunks);
  }
  
  // Deduplicate chunks by ID and keep highest score
  const chunkMap = new Map();
  for (const chunk of allChunks) {
    const existing = chunkMap.get(chunk.id);
    // Use combined_score if available (hybrid search), otherwise use similarity
    const score = chunk.combined_score ?? chunk.similarity;
    const existingScore = existing ? (existing.combined_score ?? existing.similarity) : 0;
    
    if (!existing || score > existingScore) {
      chunkMap.set(chunk.id, chunk);
    }
  }
  
  // Apply keyword overlap boosting (only for non-hybrid search)
  const boostedChunks = Array.from(chunkMap.values()).map(chunk => {
    if (useHybridSearch && chunk.combined_score !== undefined) {
      // Hybrid search already includes keyword matching, just return as-is
      return {
        ...chunk,
        similarity: chunk.combined_score, // Use combined score as similarity for sorting
        keywordScore: chunk.keyword_rank || 0
      };
    } else {
      // Original keyword boosting for semantic-only search
      const keywordScore = calculateKeywordOverlap(question, chunk.content);
      // Boost similarity by up to 20% based on keyword overlap
      const boostedSimilarity = Math.min(chunk.similarity + (keywordScore * 0.2), 1.0);
      return { ...chunk, similarity: boostedSimilarity, keywordScore };
    }
  });
  
  // Sort by boosted similarity and take top 5
  const chunks = boostedChunks
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, 5);
  
  // 6. If no good matches OR low confidence, return smart fallback
  const topConfidence = chunks.length > 0 ? chunks[0].similarity : 0;
  // With hybrid search, lower confidence is acceptable since keyword matching compensates
  const confidenceThreshold = useHybridSearch ? 0.15 : 0.4;
  if (!chunks || chunks.length === 0 || topConfidence < confidenceThreshold) {
    // Debug: Show what we found even if low confidence
    if (chunks.length > 0 && process.env.NODE_ENV === 'development') {
      console.log('Low confidence chunks found:', {
        topConfidence,
        firstChunk: chunks[0].content.substring(0, 200) + '...'
      });
    }
    // Stream the fallback message (no follow-ups for fallback)
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const result = streamText({
          model: openai('gpt-5-mini'),
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant. Provide the following message exactly as written.'
            },
            {
              role: 'user',
              content: getFallbackMessage(question, audience)
            }
          ],
          providerOptions: {
            openai: {
              reasoning_effort: 'minimal',
              textVerbosity: 'low'
            }
          }
        });
        
        writer.merge(result.toUIMessageStream());
      },
    });
    
    return createUIMessageStreamResponse({ stream });
  }
  
  // 7. Generate answer from document chunks (RAG fallback) - Always stream
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Start timing the response
      const startTime = Date.now();
      
      // Build chunk metadata for feedback tracking (Phase 3)
      const chunkMetadata = {
        chunk_ids: chunks.map(c => c.id),
        chunk_scores: chunks.map(c => c.similarity || 0),
        chunk_sources: chunks.map(c => {
          // Determine source from table name or other metadata
          if (c.table_name?.includes('parent')) return 'parent' as const;
          if (c.table_name?.includes('coach')) return 'coach' as const;
          return 'shared' as const;
        }),
        search_type: useHybridSearch ? 'hybrid' : 'rag',
        confidence_score: topConfidence
      };
      
      // Send chunk metadata first
      writer.write({
        type: 'data-chunk-metadata',
        data: chunkMetadata
      });
      
      // Build messages array with conversation history if available
      const messages = [];
      
      // Add system prompt
      messages.push({
        role: 'system' as const,
        content: getSystemPrompt(audience)
      });
      
      // If we have conversation history, convert and include it
      if (body.messages && Array.isArray(body.messages)) {
        const historicalMessages = convertToModelMessages(body.messages.slice(0, -1)); // All but the last message
        messages.push(...historicalMessages);
      }
      
      // Add the current question with context
      messages.push({
        role: 'user' as const,
        content: `Context:\n${chunks.map(c => c.content).join('\n\n')}\n\nQuestion: ${question}`
      });
      
      // Stream the RAG answer
      const result = streamText({
        model: openai('gpt-5-mini'),
        messages,
        providerOptions: {
          openai: {
            reasoning_effort: 'low',
            textVerbosity: 'low'
          }
        },
        onFinish: async ({ text }) => {
            // Calculate response time
            const responseTime = Date.now() - startTime;
            
            // Update chunk metadata with response time
            writer.write({
              type: 'data-response-metrics',
              data: { response_time_ms: responseTime }
            });
            
            // After streaming completes, generate follow-up questions
            const conversationContext = body.messages && Array.isArray(body.messages) 
              ? `Previous conversation:\n${body.messages.map((m: any) => 
                  `${m.role}: ${m.parts?.find((p: any) => p.type === 'text')?.text || m.content || ''}`
                ).join('\n')}\n\n`
              : '';
              
            const { object } = await generateObject({
              model: openai('gpt-5-mini'),
              schema: followUpQuestionsSchema,
              prompt: `${conversationContext}Based on this TSA-related exchange:
Question: "${question}"
Answer: "${text}"

Generate 3 relevant follow-up questions that a ${audience} might ask next about TSA. Don't repeat questions that were already asked in the conversation.`,
            });
            
            // Write follow-up questions as a data part
            writer.write({
              type: 'data-followups',
              id: 'followups-1',
              data: object,
            });
          },
      });
      
      // Merge the text stream
      writer.merge(result.toUIMessageStream());
    },
  });
  
  return createUIMessageStreamResponse({ stream });
}
