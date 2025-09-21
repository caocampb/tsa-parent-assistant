import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import OpenAI from 'openai';
import { encoding_for_model } from 'tiktoken';

// Force Node.js runtime for tiktoken compatibility
export const runtime = 'nodejs';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Format embeddings for PostgreSQL vector type
function formatPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          error: {
            type: 'configuration_error',
            message: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.',
            code: 'missing_api_key'
          }
        },
        { status: 500 }
      );
    }

    // Check idempotency key
    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey) {
      return NextResponse.json(
        { 
          error: {
            type: 'missing_header',
            message: 'Idempotency-Key header is required',
            code: 'idempotency_key_required'
          }
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const audience = (formData.get('audience') as string) || 'parent'; // Default to parent
    
    if (!file) {
      return NextResponse.json(
        { 
          error: {
            type: 'invalid_request',
            message: 'No file provided',
            code: 'file_required'
          }
        },
        { status: 400 }
      );
    }

    // Check file type
    const fileType = file.name.split('.').pop()?.toLowerCase();
    const validTypes = ['pdf', 'docx', 'txt', 'mp3', 'wav'];
    
    if (!fileType || !validTypes.includes(fileType)) {
      return NextResponse.json(
        { 
          error: {
            type: 'invalid_file_type',
            message: `File type .${fileType} not supported. Accepted: PDF, DOCX, TXT, MP3, WAV`,
            code: 'invalid_file_type'
          }
        },
        { status: 400 }
      );
    }

    // Map audience to correct table
    const tableMap = {
      parent: 'documents_parent',
      coach: 'documents_coach',
      shared: 'documents_shared'
    };
    const documentsTable = tableMap[audience as keyof typeof tableMap] || 'documents_parent';
    const chunksTable = `document_chunks_${audience}`;
    
    // Check for duplicate upload using idempotency key
    const { data: existing } = await supabase
      .from(documentsTable)
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existing) {
      // Get chunk count separately
      const { count: chunkCount } = await supabase
        .from(chunksTable)
        .select('*', { count: 'exact', head: true })
        .eq('document_id', existing.id);
      
      // Return existing document (idempotent)
      return NextResponse.json({
        id: existing.id,
        filename: existing.filename,
        doc_type: existing.doc_type,
        chunk_count: chunkCount || 0,
        uploaded_at: existing.uploaded_at
      }, { status: 200 });
    }

    // Determine document type
    const docType = getDocType(fileType, file.name);

    // Store the document
    const { data: document, error: dbError } = await supabase
      .from(documentsTable)
      .insert({
        filename: file.name,
        doc_type: docType,
        idempotency_key: idempotencyKey
      })
      .select()
      .single();

    if (dbError) {
      console.error('Document save error:', dbError);
      return NextResponse.json(
        { 
          error: {
            type: 'database_error',
            message: 'Failed to save document: ' + dbError.message,
            code: 'database_error'
          }
        },
        { status: 500 }
      );
    }

    // Process file content
    const chunks = await processFile(file, document.id, audience);
    
    // Return resource with actual chunk count and embedding status
    return NextResponse.json({
      id: document.id,
      filename: document.filename,
      doc_type: document.doc_type,
      chunk_count: chunks.length,
      uploaded_at: document.uploaded_at,
      embeddings_generated: chunks.length > 0,
      message: chunks.length > 0 ? `Successfully processed ${chunks.length} chunks with embeddings` : 'Document uploaded'
    }, { status: 201 }); // 201 Created

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { 
        error: {
          type: 'internal_error',
          message: 'An unexpected error occurred',
          code: 'internal_error'
        }
      },
      { status: 500 }
    );
  }
}

// GET /api/documents - List all documents
export async function GET() {
  try {
    console.log('[Documents API] Called');
    console.log('[Documents API] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) + '...');
    console.log('[Documents API] Has anon key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.log('[Documents API] Has service key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Create fresh client for this request
    const supabase = createSupabaseClient();
    
    // Test each table individually to identify which one fails
    console.log('[Documents API] Testing documents_parent...');
    const parentDocs = await supabase.from('documents_parent').select('*').order('uploaded_at', { ascending: false });
    console.log('[Documents API] Parent result:', { count: parentDocs.data?.length, error: parentDocs.error });
    
    console.log('[Documents API] Testing documents_coach...');
    const coachDocs = await supabase.from('documents_coach').select('*').order('uploaded_at', { ascending: false });
    console.log('[Documents API] Coach result:', { count: coachDocs.data?.length, error: coachDocs.error });
    
    console.log('[Documents API] Testing documents_shared...');
    const sharedDocs = await supabase.from('documents_shared').select('*').order('uploaded_at', { ascending: false });
    console.log('[Documents API] Shared result:', { count: sharedDocs.data?.length, error: sharedDocs.error });
    
    console.log('[Documents API] Query results:', {
      parent: parentDocs.data?.length || 0,
      parentError: parentDocs.error,
      coach: coachDocs.data?.length || 0,
      coachError: coachDocs.error,
      shared: sharedDocs.data?.length || 0,
      sharedError: sharedDocs.error
    });
  
  // Combine results with audience tags
  const allDocs = [
    ...(parentDocs.data || []).map(doc => ({ ...doc, audience: 'parent' })),
    ...(coachDocs.data || []).map(doc => ({ ...doc, audience: 'coach' })),
    ...(sharedDocs.data || []).map(doc => ({ ...doc, audience: 'shared' }))
  ];
  
  // Sort by upload date
  const sortedDocs = allDocs.sort((a, b) => 
    new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );

  if (parentDocs.error || coachDocs.error || sharedDocs.error) {
    return NextResponse.json(
      { 
        error: {
          type: 'database_error',
          message: 'Failed to fetch documents',
          code: 'database_error'
        }
      },
      { status: 500 }
    );
  }

  return NextResponse.json(sortedDocs);
  } catch (error) {
    console.error('[Documents API] Caught error:', error);
    console.error('[Documents API] Error type:', typeof error);
    console.error('[Documents API] Error details:', JSON.stringify(error, null, 2));
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch documents',
        details: error instanceof Error ? error.message : 'Unknown error',
        env: {
          hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        }
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');
    const audience = searchParams.get('audience');
    
    if (!documentId || !audience) {
      return NextResponse.json(
        { 
          error: {
            type: 'invalid_request',
            message: 'Document ID and audience are required',
            code: 'missing_parameters'
          }
        },
        { status: 400 }
      );
    }
    
    // Map audience to correct table
    const tableMap = {
      parent: 'documents_parent',
      coach: 'documents_coach',
      shared: 'documents_shared'
    };
    const documentsTable = tableMap[audience as keyof typeof tableMap];
    const chunksTable = `document_chunks_${audience}`;
    
    if (!documentsTable) {
      return NextResponse.json(
        { 
          error: {
            type: 'invalid_request',
            message: 'Invalid audience',
            code: 'invalid_audience'
          }
        },
        { status: 400 }
      );
    }
    
    // Delete chunks first (due to foreign key constraint)
    const { error: chunksError } = await supabase
      .from(chunksTable)
      .delete()
      .eq('document_id', documentId);
    
    if (chunksError) {
      console.error('Error deleting chunks:', chunksError);
    }
    
    // Delete the document
    const { data, error } = await supabase
      .from(documentsTable)
      .delete()
      .eq('id', documentId)
      .select()
      .single();
    
    if (error) {
      console.error('Document delete error:', error);
      return NextResponse.json(
        { 
          error: {
            type: 'database_error',
            message: 'Failed to delete document',
            code: 'database_error'
          }
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      deleted: data
    });
    
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { 
        error: {
          type: 'server_error',
          message: error.message || 'Internal server error',
          code: 'internal_error'
        }
      },
      { status: 500 }
    );
  }
}

// Process file and create chunks
async function processFile(file: File, documentId: string, audience: string = 'parent'): Promise<any[]> {
  const supabase = createSupabaseClient();
  const fileType = file.name.split('.').pop()?.toLowerCase();
  let content = '';
  let pageNumber: number | null = null;
  let audioTimestamp: number | null = null;

  // Parse file based on type
  switch (fileType) {
    case 'pdf':
      const pdfBuffer = await file.arrayBuffer();
      try {
        // Use unpdf for modern, reliable PDF text extraction
        const { text } = await extractText(new Uint8Array(pdfBuffer), {
          mergePages: true // Merge all pages into single text for chunking
        });
        content = text;
      } catch (error: any) {
        console.error('PDF parsing error:', error);
        throw new Error(`Failed to parse PDF: ${error.message}`);
      }
      break;
      
    case 'docx':
      const docxBuffer = await file.arrayBuffer();
      const docxResult = await mammoth.extractRawText({ buffer: Buffer.from(docxBuffer) });
      content = docxResult.value;
      break;
      
    case 'txt':
      content = await file.text();
      break;
      
    case 'mp3':
    case 'wav':
      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured for audio transcription');
      }
      
      // Transcribe audio using Whisper
      try {
        const audioFile = new File([await file.arrayBuffer()], file.name, { type: file.type });
        
        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          response_format: 'verbose_json', // Get timestamps
          language: 'en' // TSA is English-only
        }) as any; // Type assertion for verbose response
        
        // Process segments with timestamps
        if (transcription.segments) {
          // Combine segments into larger chunks while preserving timestamps
          const segments = transcription.segments;
          let currentChunk = '';
          let currentStartTime = 0;
          const timedChunks: { content: string; timestamp: number }[] = [];
          
          for (const segment of segments) {
            // If adding this segment would exceed chunk size, save current chunk
            if (currentChunk.length + segment.text.length > 1000) {
              if (currentChunk) {
                timedChunks.push({
                  content: currentChunk.trim(),
                  timestamp: currentStartTime
                });
              }
              currentChunk = segment.text;
              currentStartTime = segment.start;
            } else {
              currentChunk += ' ' + segment.text;
            }
          }
          
          // Don't forget the last chunk
          if (currentChunk) {
            timedChunks.push({
              content: currentChunk.trim(),
              timestamp: currentStartTime
            });
          }
          
          // Generate embeddings for audio chunks
          console.log(`Generating embeddings for ${timedChunks.length} audio chunks...`);
          const chunkRecords = [];
          
          for (let i = 0; i < timedChunks.length; i++) {
            const chunk = timedChunks[i];
            
            try {
              // Generate embedding for this chunk
              const embeddingResponse = await openai.embeddings.create({
                input: chunk.content,
                model: 'text-embedding-3-large',
                dimensions: 1536
              });
              
              chunkRecords.push({
                document_id: documentId,
                chunk_index: i,
                content: chunk.content,
                page_number: null,
                audio_timestamp: chunk.timestamp,
                embedding: formatPgVector(embeddingResponse.data[0].embedding) as any
              });
            } catch (error: any) {
              console.error(`Error generating embedding for audio chunk ${i}:`, error);
              throw new Error(`Failed to generate audio embeddings: ${error.message}`);
            }
          }
          
          if (chunkRecords.length > 0) {
            const { error } = await supabase
              .from(`document_chunks_${audience}`)
              .insert(chunkRecords);
              
            if (error) {
              console.error('Error storing audio chunks:', error);
              throw new Error('Failed to store audio chunks');
            }
          }
          
          return chunkRecords;
        } else {
          // Fallback: use full text without timestamps
          content = transcription.text;
        }
      } catch (error: any) {
        console.error('Audio transcription error:', error);
        throw new Error(`Audio transcription failed: ${error.message}`);
      }
      break;
      
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }

  // Skip if already processed (audio with timestamps)
  if (fileType === 'mp3' || fileType === 'wav') {
    // Audio was already processed with timestamps
    return [];
  }

  // Chunk the content for non-audio files
  // Using exact token counting with tiktoken for accurate chunking
  // cl100k_base is used by text-embedding-3-large
  const encoder = encoding_for_model('text-embedding-3-large');
  
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,       // Standard size for semantic completeness
    chunkOverlap: 128,    // 25% overlap for context continuity
    separators: ['\n\n', '\n', '. ', ' ', ''],
    lengthFunction: (text: string) => {
      // Count exact tokens using the same encoding as our embedding model
      return encoder.encode(text).length;
    }
  });

  const chunks = await splitter.splitText(content);
  
  // Generate embeddings for each chunk
  console.log(`Generating embeddings for ${chunks.length} chunks...`);
  const chunkRecords = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    try {
      // Generate embedding for this chunk
      const embeddingResponse = await openai.embeddings.create({
        input: chunk,
        model: 'text-embedding-3-large',
        dimensions: 1536 // Match our vector column size
      });
      
      chunkRecords.push({
        document_id: documentId,
        chunk_index: i,
        content: chunk,
        page_number: pageNumber,
        audio_timestamp: audioTimestamp,
        embedding: formatPgVector(embeddingResponse.data[0].embedding) as any
      });
    } catch (error: any) {
      console.error(`Error generating embedding for chunk ${i}:`, error);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }

  if (chunkRecords.length > 0) {
      const { error } = await supabase
        .from(`document_chunks_${audience}`)
        .insert(chunkRecords);

    if (error) {
      console.error('Error storing chunks:', error);
      throw new Error('Failed to store document chunks');
    }
  }

  // Free the encoder to prevent memory leaks
  encoder.free();

  return chunkRecords;
}

function getDocType(fileType: string, filename: string): string {
  const lower = filename.toLowerCase();
  
  if (lower.includes('handbook')) return 'handbook';
  if (lower.includes('newsletter')) return 'newsletter';
  if (lower.includes('minutes') || lower.includes('meeting')) return 'minutes';
  if (fileType === 'mp3' || fileType === 'wav') return 'transcript';
  if (lower.includes('schedule')) return 'schedule';
  if (lower.includes('policy') || lower.includes('policies')) return 'policy';
  
  return fileType === 'pdf' ? 'handbook' : 'document';
}
