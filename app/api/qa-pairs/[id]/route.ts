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

// Extract UUID from prefixed ID (qa_uuid -> uuid)
function extractUUID(id: string): string {
  return id.startsWith('qa_') ? id.slice(3) : id;
}

// PATCH /api/qa-pairs/:id - Update Q&A pair
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const uuid = extractUUID(id);
    const body = await request.json();
    const { question, answer, audience, category } = body;

    // Build update object
    const updates: any = {};
    if (answer !== undefined) updates.answer = answer;
    if (audience !== undefined) {
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
      updates.audience = audience;
    }
    if (category !== undefined) updates.category = category;

    // If question is being updated, regenerate embedding
    if (question !== undefined) {
      updates.question = question;
      const embedding = await openai.embeddings.create({
        input: question,
        model: 'text-embedding-3-large',
        dimensions: 1536
      });
      updates.embedding = formatPgVector(embedding.data[0].embedding) as any;
    }

    // Perform update
    const { data, error } = await supabase
      .from('qa_pairs')
      .update(updates)
      .eq('id', uuid)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { 
            error: {
              type: 'not_found',
              message: 'Q&A pair not found',
              code: 'qa_not_found'
            }
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { 
          error: {
            type: 'database_error',
            message: 'Failed to update Q&A pair',
            code: 'update_failed'
          }
        },
        { status: 500 }
      );
    }

    // Return updated Q&A pair with prefixed ID
    return NextResponse.json({
      id: `qa_${data.id}`,
      ...data
    });

  } catch (error) {
    console.error('Error updating Q&A pair:', error);
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

// DELETE /api/qa-pairs/:id - Delete Q&A pair
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const uuid = extractUUID(id);

    const { error } = await supabase
      .from('qa_pairs')
      .delete()
      .eq('id', uuid);

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { 
            error: {
              type: 'not_found',
              message: 'Q&A pair not found',
              code: 'qa_not_found'
            }
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { 
          error: {
            type: 'database_error',
            message: 'Failed to delete Q&A pair',
            code: 'delete_failed'
          }
        },
        { status: 500 }
      );
    }

    // Return 204 No Content on successful deletion
    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error('Error deleting Q&A pair:', error);
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

// GET /api/qa-pairs/:id - Get single Q&A pair
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const uuid = extractUUID(id);

    const { data, error } = await supabase
      .from('qa_pairs')
      .select('*')
      .eq('id', uuid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { 
            error: {
              type: 'not_found',
              message: 'Q&A pair not found',
              code: 'qa_not_found'
            }
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { 
          error: {
            type: 'database_error',
            message: 'Failed to fetch Q&A pair',
            code: 'fetch_failed'
          }
        },
        { status: 500 }
      );
    }

    // Return Q&A pair with prefixed ID
    return NextResponse.json({
      id: `qa_${data.id}`,
      ...data
    });

  } catch (error) {
    console.error('Error fetching Q&A pair:', error);
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
