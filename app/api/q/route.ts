import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { getSystemPrompt, getQAPrompt } from '@/lib/prompts';

/**
 * GPT-5 Feature Implementation:
 * - Q&A pairs: Use gpt-5-mini with minimal reasoning for fast responses
 * - Simple RAG: Use gpt-5-mini with low reasoning
 * - Complex RAG: Use gpt-5 with medium reasoning (when >3 chunks or <60% confidence)
 * 
 * Note: Using providerOptions.openai for GPT-5 specific parameters:
 * - reasoning_effort: Controls reasoning token generation
 * - textVerbosity: Controls response length
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
  
  // Common rephrasing patterns
  const replacements = [
    [/how much does (.*) cost/i, 'what is the cost of $1'],
    [/what's/i, 'what is'],
    [/i'm/i, 'i am'],
    [/tell me all/i, 'what are all'],
    [/tell me about/i, 'what is'],
  ];
  
  for (const [pattern, replacement] of replacements) {
    const rephrased = question.replace(pattern, replacement as string);
    if (rephrased !== question && !variations.includes(rephrased)) {
      variations.push(rephrased);
    }
  }
  
  return variations;
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
  const contactInfo = "Please contact TSA at (512) 555-8722";
  
  const fallbacks = {
    payment: `For payment method options and billing questions, ${contactInfo} or email billing@texassportsacademy.com.`,
    schedule: `For specific schedule and timing questions, please check with ${audience === 'parent' ? 'your coach or the front desk' : 'the TSA operations team'} at (512) 555-8722.`,
    pricing: `For detailed pricing and fee information, ${contactInfo} to speak with our enrollment team.`,
    insurance: `For insurance requirements and coverage details, ${contactInfo} or email info@texassportsacademy.com.`,
    facility: `For facility and space requirements, please contact our real estate team at (512) 555-8722.`,
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
  
  // Count overlapping keywords
  let overlap = 0;
  for (const keyword of questionKeywords) {
    if (contentKeywords.includes(keyword)) {
      overlap++;
    }
  }
  
  // Return normalized score (0-1)
  return questionKeywords.size > 0 ? overlap / questionKeywords.size : 0;
}

export async function POST(request: NextRequest) {
  const { question, audience: providedAudience } = await request.json();
  
  // Check if client wants streaming (default to JSON for compatibility)
  const acceptsStream = request.headers.get('accept')?.includes('text/event-stream');
  
  // 1. Use provided audience (default to 'parent' if not provided)
  const audience = providedAudience || 'parent';

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
  
  for (const embedding of embeddings) {
    const { data: qaPairs, error: qaError } = await supabase.rpc('search_qa_pairs', {
      query_embedding: embedding.data[0].embedding,
      match_count: 1,
      similarity_threshold: 0.75,
      filter_audience: audience
    });
    
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
      willUseQA: bestQAMatch && bestQAMatch.similarity >= 0.85,
      ragFallback: !bestQAMatch || bestQAMatch.similarity < 0.85
    });
  }
  
  // If we have a high-confidence Q&A match, use it directly
  if (bestQAMatch && bestQAMatch.similarity >= 0.85) {
    const qaAnswer = bestQAMatch.answer;
    
    if (acceptsStream) {
      // Stream the Q&A answer with minimal reasoning for fast response
      const result = await streamText({
        model: openai('gpt-5-mini'),
        messages: [
          {
            role: 'system',
            content: getQAPrompt()
          },
          {
            role: 'user',
            content: qaAnswer
          }
        ],
        providerOptions: {
          openai: {
            reasoning_effort: 'minimal',
            textVerbosity: 'low'
          }
        }
      });
      return (result as any).toUIMessageStreamResponse();
    } else {
      // Return Q&A answer as JSON
      return NextResponse.json({
        id: `q_${Date.now()}`,
        question: question,
        answer: qaAnswer,
        sources: [{
          type: 'qa_pair',
          question: bestQAMatch.question,
          category: bestQAMatch.category,
          similarity: bestQAMatch.similarity
        }],
        confidence: bestQAMatch.similarity,
        created_at: new Date().toISOString()
      });
    }
  }
  
  // 5. Fall back to RAG: Search document chunks
  // Search the appropriate audience-specific table
  const searchFunction = audience === 'coach' ? 'search_documents_coach' : 'search_documents_parent';
  
  // Search with all embeddings and combine results
  const allChunks = [];
  
  for (const embedding of embeddings) {
    const [{ data: audienceChunks }, { data: sharedChunks }] = await Promise.all([
      supabase.rpc(searchFunction, {
        query_embedding: embedding.data[0].embedding,
        match_count: 2,
        similarity_threshold: 0.4
      }),
      supabase.rpc('search_documents_shared', {
        query_embedding: embedding.data[0].embedding,
        match_count: 1,
        similarity_threshold: 0.4
      })
    ]);
    
    allChunks.push(...(audienceChunks || []), ...(sharedChunks || []));
  }
  
  // Deduplicate chunks by ID and keep highest similarity
  const chunkMap = new Map();
  for (const chunk of allChunks) {
    const existing = chunkMap.get(chunk.id);
    if (!existing || chunk.similarity > existing.similarity) {
      chunkMap.set(chunk.id, chunk);
    }
  }
  
  // Apply keyword overlap boosting
  const boostedChunks = Array.from(chunkMap.values()).map(chunk => {
    const keywordScore = calculateKeywordOverlap(question, chunk.content);
    // Boost similarity by up to 20% based on keyword overlap
    const boostedSimilarity = Math.min(chunk.similarity + (keywordScore * 0.2), 1.0);
    return { ...chunk, similarity: boostedSimilarity, keywordScore };
  });
  
  // Sort by boosted similarity and take top 5
  const chunks = boostedChunks
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, 5);
  
  // 6. If no good matches OR low confidence, return smart fallback
  const topConfidence = chunks.length > 0 ? chunks[0].similarity : 0;
  if (!chunks || chunks.length === 0 || topConfidence < 0.4) {
    // Debug: Show what we found even if low confidence
    if (chunks.length > 0 && process.env.NODE_ENV === 'development') {
      console.log('Low confidence chunks found:', {
        topConfidence,
        firstChunk: chunks[0].content.substring(0, 200) + '...'
      });
    }
    return NextResponse.json({
      answer: getFallbackMessage(question, audience),
      sources: [],
      confidence: 0
    });
  }
  
  // 7. Generate answer from document chunks (RAG fallback)
  if (acceptsStream) {
    // Streaming response for UI
    // Determine model and reasoning based on complexity
    const useAdvancedModel = chunks.length > 3 || topConfidence < 0.6;
    
    const result = await streamText({
      model: openai(useAdvancedModel ? 'gpt-5' : 'gpt-5-mini'),
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(audience)
        },
        {
          role: 'user',
          content: `Context:\n${chunks.map(c => c.content).join('\n\n')}\n\nQuestion: ${question}`
        }
      ],
      providerOptions: {
        openai: {
          reasoning_effort: useAdvancedModel ? 'medium' : 'low',
          textVerbosity: 'medium'
        }
      }
    });
    
    // Use toUIMessageStreamResponse from the prototype
    return (result as any).toUIMessageStreamResponse();
  } else {
    // JSON response for testing
    // Use same logic as streaming for model selection
    const useAdvancedModel = chunks.length > 3 || topConfidence < 0.6;
    
    const { text } = await generateText({
      model: openai(useAdvancedModel ? 'gpt-5' : 'gpt-5-mini'),
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(audience)
        },
        {
          role: 'user',
          content: `Context:\n${chunks.map(c => c.content).join('\n\n')}\n\nQuestion: ${question}`
        }
      ],
      providerOptions: {
        openai: {
          reasoning_effort: useAdvancedModel ? 'medium' : 'low',
          textVerbosity: 'medium'
        }
      }
    });
    
    // Return JSON response matching the expected format
    return NextResponse.json({
      id: `q_${Date.now()}`,
      question: question,
      answer: text,
      sources: chunks.map(chunk => ({
        chunk_id: chunk.chunk_id,
        document_id: chunk.document_id,
        content: chunk.content,
        similarity: chunk.similarity,
        page_number: chunk.page_number
      })),
      confidence: chunks[0]?.similarity || 0,
      created_at: new Date().toISOString()
    });
  }
}
