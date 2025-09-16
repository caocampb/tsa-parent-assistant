import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

export async function POST(request: NextRequest) {
  try {
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

    // Check for duplicate upload using idempotency key
    const { data: existing } = await supabase
      .from('documents')
      .select(`
        *,
        document_chunks(count)
      `)
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existing) {
      // Return existing document (idempotent)
      const chunkCount = existing.document_chunks?.[0]?.count || 0;
      return NextResponse.json({
        id: existing.id,
        filename: existing.filename,
        doc_type: existing.doc_type,
        chunk_count: chunkCount,
        uploaded_at: existing.uploaded_at
      }, { status: 200 });
    }

    // Determine document type
    const docType = getDocType(fileType, file.name);

    // Store the document
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        filename: file.name,
        doc_type: docType,
        idempotency_key: idempotencyKey
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json(
        { 
          error: {
            type: 'database_error',
            message: 'Failed to save document',
            code: 'database_error'
          }
        },
        { status: 500 }
      );
    }

    // Process file content
    const chunks = await processFile(file, document.id);
    
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
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('uploaded_at', { ascending: false });

  if (error) {
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

  return NextResponse.json(data);
}

// Process file and create chunks
async function processFile(file: File, documentId: string): Promise<any[]> {
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
                embedding: embeddingResponse.data[0].embedding
              });
            } catch (error: any) {
              console.error(`Error generating embedding for audio chunk ${i}:`, error);
              throw new Error(`Failed to generate audio embeddings: ${error.message}`);
            }
          }
          
          if (chunkRecords.length > 0) {
            const { error } = await supabase
              .from('document_chunks')
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
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n', '. ', ' ', '']
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
        embedding: embeddingResponse.data[0].embedding
      });
    } catch (error: any) {
      console.error(`Error generating embedding for chunk ${i}:`, error);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }

  if (chunkRecords.length > 0) {
    const { error } = await supabase
      .from('document_chunks')
      .insert(chunkRecords);

    if (error) {
      console.error('Error storing chunks:', error);
      throw new Error('Failed to store document chunks');
    }
  }

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
