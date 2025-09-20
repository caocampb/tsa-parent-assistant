import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.question || !body.answer || !body.feedback) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Complete feedback save with chunk tracking (Phase 3)
    const { data, error } = await supabase
      .from('answer_feedback')
      .insert({
        question: body.question,
        answer: body.answer.substring(0, 1000), // Truncate long answers
        audience: body.audience || 'parent',
        feedback: body.feedback,
        // Chunk metadata (Phase 3)
        chunk_ids: body.chunk_ids || [],
        chunk_scores: body.chunk_scores || [],
        chunk_sources: body.chunk_sources || [],
        search_type: body.search_type,
        confidence_score: body.confidence_score,
        response_time_ms: body.response_time_ms,
        model_used: 'gpt-5-mini'
      })
      .select()
      .single();
    
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Feedback save error:', error);
      }
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      id: data.id 
    });
    
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Feedback API error:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
