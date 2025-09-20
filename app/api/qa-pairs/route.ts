import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

// Format embeddings for PostgreSQL
function formatPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

// GET /api/qa-pairs - List Q&A pairs with filtering
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const audience = searchParams.get('audience');
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Build query
  let query = supabase
    .from('qa_pairs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (audience) {
    query = query.or(`audience.eq.${audience},audience.eq.both`);
  }
  if (category) {
    query = query.eq('category', category);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { 
        error: {
          type: 'database_error',
          message: 'Failed to fetch Q&A pairs',
          code: 'fetch_failed'
        }
      },
      { status: 500 }
    );
  }

  // Return data with pagination info
  return NextResponse.json({
    data: data || [],
    pagination: {
      total: count || 0,
      limit,
      offset,
      has_more: (count || 0) > offset + limit
    }
  });
}

// POST /api/qa-pairs - Create new Q&A pair
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, answer, audience = 'parent', category = 'general_sales' } = body;

    // Validate required fields
    if (!question || !answer) {
      return NextResponse.json(
        { 
          error: {
            type: 'invalid_request',
            message: 'Question and answer are required',
            code: 'missing_fields'
          }
        },
        { status: 400 }
      );
    }

    // Validate audience
    if (!['parent', 'coach', 'both'].includes(audience)) {
      return NextResponse.json(
        { 
          error: {
            type: 'invalid_request',
            message: 'Audience must be parent, coach, or both',
            code: 'invalid_audience'
          }
        },
        { status: 400 }
      );
    }

    // Generate embedding for the question
    const embedding = await openai.embeddings.create({
      input: question,
      model: 'text-embedding-3-large',
      dimensions: 1536
    });

    // Insert Q&A pair
    const { data, error } = await supabase
      .from('qa_pairs')
      .insert({
        question,
        answer,
        category,
        audience,
        embedding: formatPgVector(embedding.data[0].embedding) as any
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { 
          error: {
            type: 'database_error',
            message: 'Failed to create Q&A pair',
            code: 'insert_failed',
            details: error
          }
        },
        { status: 500 }
      );
    }

    // Return created Q&A pair with prefixed ID
    return NextResponse.json({
      id: `qa_${data.id}`,
      ...data,
      created_at: data.created_at
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating Q&A pair:', error);
    return NextResponse.json(
      { 
        error: {
          type: 'server_error',
          message: 'Internal server error',
          code: 'internal_error'
        }
      },
      { status: 500 }
    );
  }
}
