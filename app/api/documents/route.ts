import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export async function POST(request: NextRequest) {
  try {
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
    
    // Return resource with actual chunk count
    return NextResponse.json({
      id: document.id,
      filename: document.filename,
      doc_type: document.doc_type,
      chunk_count: chunks.length,
      uploaded_at: document.uploaded_at
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
      const pdfData = await pdf(Buffer.from(pdfBuffer));
      content = pdfData.text;
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
      // TODO: Implement audio transcription with OpenAI Whisper
      console.log('Audio transcription not implemented yet');
      return [];
      
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }

  // Chunk the content
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n', '. ', ' ', '']
  });

  const chunks = await splitter.splitText(content);
  
  // Store chunks in database
  const chunkRecords = chunks.map((chunk, index) => ({
    document_id: documentId,
    chunk_index: index,
    content: chunk,
    page_number: pageNumber,
    audio_timestamp: audioTimestamp,
    // embedding will be added later
  }));

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
