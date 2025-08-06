import { NextRequest, NextResponse } from 'next/server';
import { getClaudeService } from '@/lib/claude';
import { Message } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { messages, query, isVoiceInput } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const claudeService = getClaudeService();
    
    // If this is voice input, clean it up first
    const cleanQuery = isVoiceInput 
      ? await claudeService.cleanupVoiceTranscript(query)
      : query;

    // Generate response with knowledge base context
    const { response, relevantArticles } = await claudeService.generateResponse(
      messages as Message[], 
      cleanQuery
    );

    return NextResponse.json({
      response,
      cleanedQuery: isVoiceInput ? cleanQuery : null,
      relevantArticles,
      success: true
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';

    return NextResponse.json(
      { 
        error: errorMessage,
        success: false 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Chat API is running' },
    { status: 200 }
  );
}