import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    
    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      input: query,
      model: 'text-embedding-3-large',
      dimensions: 1536
    });
    
    return NextResponse.json({
      query,
      embedding: embeddingResponse.data[0].embedding,
      dimensions: embeddingResponse.data[0].embedding.length
    });
  } catch (error: any) {
    console.error('Embedding error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
