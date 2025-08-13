import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/admin-service';
import { initializeDatabase } from '@/lib/database';

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function GET() {
  try {
    await ensureDatabase();
    const chunks = await adminService.getAllChunks();
    
    return NextResponse.json({
      success: true,
      chunks,
    });
  } catch (error) {
    console.error('Error fetching chunks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch chunks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const question = formData.get('question') as string;
    const orderIndex = formData.get('orderIndex') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!question) {
      return NextResponse.json(
        { success: false, error: 'Question is required' },
        { status: 400 }
      );
    }

    const finalOrderIndex = orderIndex ? parseInt(orderIndex) : undefined;
    
    const newChunk = await adminService.uploadChunk(
      file,
      title,
      question,
      finalOrderIndex
    );

    return NextResponse.json({
      success: true,
      chunk: newChunk,
    });
  } catch (error) {
    console.error('Error uploading chunk:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload chunk' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { action, ...data } = await request.json();

    switch (action) {
      case 'reorder':
        const { chunkIds } = data;
        if (!Array.isArray(chunkIds)) {
          return NextResponse.json(
            { success: false, error: 'chunkIds must be an array' },
            { status: 400 }
          );
        }
        
        await adminService.reorderChunks(chunkIds);
        return NextResponse.json({ success: true });

      case 'toggle_active':
        const { chunkId, active } = data;
        if (!chunkId || typeof active !== 'boolean') {
          return NextResponse.json(
            { success: false, error: 'chunkId and active status required' },
            { status: 400 }
          );
        }
        
        await adminService.toggleChunkActive(chunkId, active);
        return NextResponse.json({ success: true });

      case 'update_content':
        const { chunkId: updateChunkId, title, content, question } = data;
        if (!updateChunkId) {
          return NextResponse.json(
            { success: false, error: 'chunkId is required' },
            { status: 400 }
          );
        }
        
        await adminService.updateChunkContent(updateChunkId, {
          title,
          content, 
          question
        });
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error updating chunks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update chunks' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const chunkId = searchParams.get('id');

    if (!chunkId) {
      return NextResponse.json(
        { success: false, error: 'Chunk ID is required' },
        { status: 400 }
      );
    }

    await adminService.deleteChunk(chunkId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chunk:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete chunk' },
      { status: 500 }
    );
  }
}