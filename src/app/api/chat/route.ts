import { NextRequest, NextResponse } from 'next/server';
import { getClaudeService } from '@/lib/claude-enhanced';
import { Message } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { messages, query, generateIntro } = await request.json();

    const claudeService = getClaudeService();

    // Handle introduction generation for new sessions
    if (generateIntro) {
      const introMessage = "Hi! I'm the AI version of Sanjay Bhargava, founding member of PayPal. What brings you here today?";
      
      return NextResponse.json({
        response: introMessage,
        citedArticles: [],
        searchResults: [],
        success: true
      });
    }

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    // Use RAG-enhanced response for better knowledge integration
    const ragResponse = await claudeService.sendMessageWithContext(
      messages as Message[], 
      query
    );

    return NextResponse.json({
      response: ragResponse.response,
      citedArticles: ragResponse.citedArticles,
      searchResults: ragResponse.searchResults,
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