import { NextRequest, NextResponse } from 'next/server';
import { educationalSessionService } from '@/lib/educational-session';
import { getClaudeService } from '@/lib/claude-enhanced';
import { initializeDatabase } from '@/lib/database';

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { action, ...data } = await request.json();

    switch (action) {
      case 'create':
        // Check if session already exists first
        const { personalizationEnabled, conversationAware, sessionId: createSessionId } = data;
        
        // Get admin settings to determine structured mode
        const createAdminSettings = await educationalSessionService.getAdminSettings();
        const useStructuredMode = createAdminSettings?.useStructuredConversation ?? true;
        
        let session;
        if (createSessionId) {
          // Try to get existing session first
          session = await educationalSessionService.getSession(createSessionId);
        }
        
        if (!session) {
          // Session doesn't exist, create a new one
          session = await educationalSessionService.createNewSession(
            personalizationEnabled, 
            createSessionId, 
            useStructuredMode ? 'structured' : 'open-ended',
            conversationAware
          );
        }
        
        // Get the first chunk
        const firstChunk = await educationalSessionService.getCurrentChunk(session.id);
        const voiceSettings = await educationalSessionService.getVoiceSettings();
        
        return NextResponse.json({
          success: true,
          session: session,
          currentChunk: firstChunk,
          voiceSettings,
          structuredMode: useStructuredMode,
          conversationMode: useStructuredMode ? 'structured' : 'open-ended'
        });

      case 'get_current_chunk':
        const { sessionId: chunkSessionId } = data;
        if (!chunkSessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        const currentChunk = await educationalSessionService.getCurrentChunk(chunkSessionId);
        const chunkSession = await educationalSessionService.getSession(chunkSessionId);
        
        if (!currentChunk || !chunkSession) {
          return NextResponse.json(
            { success: false, error: 'Session or chunk not found' },
            { status: 404 }
          );
        }

        // Process chunk content based on personalization setting
        const processedContent = await educationalSessionService.processChunkContent(
          chunkSessionId,
          currentChunk.content,
          chunkSession.personalizationEnabled
        );

        return NextResponse.json({
          success: true,
          chunk: {
            ...currentChunk,
            content: processedContent
          },
          session: chunkSession,
        });

      case 'process_conversation':
        // This handles the full conversational flow with ElevenLabs
        const { sessionId: convSessionId, userMessage, conversationHistory } = data;
        
        if (!convSessionId || !userMessage) {
          return NextResponse.json(
            { success: false, error: 'Session ID and user message are required' },
            { status: 400 }
          );
        }

        // Get current session and chunk
        const convSession = await educationalSessionService.getSession(convSessionId);
        const convCurrentChunk = await educationalSessionService.getCurrentChunk(convSessionId);
        
        if (!convSession) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        // If no current chunk, session is completed
        if (!convCurrentChunk) {
          // Auto-generate report for completed session
          try {
            const reportResponse = await fetch(`${request.nextUrl.origin}/api/reports`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'generate',
                sessionId: convSessionId,
                options: {
                  includeResponses: true,
                  includeTimestamps: true,
                  includePersonalizationNotes: convSession.personalizationEnabled,
                  useBaseTemplate: true
                }
              })
            });

            const reportData = await reportResponse.json();
            
            return NextResponse.json({
              success: true,
              response: "Thank you for completing the educational program! Your comprehensive report has been generated and is available for download.",
              sessionCompleted: true,
              reportGenerated: reportData.success,
              reportId: reportData.reportId
            });
          } catch (reportError) {
            console.error('Auto-report generation failed:', reportError);
            return NextResponse.json({
              success: true,
              response: "Thank you for completing the educational program! You should receive a comprehensive report shortly.",
              sessionCompleted: true,
              shouldGenerateReport: true,
            });
          }
        }

        // Check if structured conversation is enabled in admin settings
        const adminSettings = await educationalSessionService.getAdminSettings();
        const useStructured = adminSettings?.useStructuredConversation ?? true;
        
        const claudeService = getClaudeService();
        
        // If structured conversation is disabled, bypass all chunk logic and use open-ended conversation
        if (!useStructured) {
          // Use QA prompt for open-ended conversation
          const qaPrompt = await educationalSessionService.getSystemPrompt('qa');
          const systemPrompt = qaPrompt?.content || 'You are a helpful financial advisor assistant.';
          
          const conversationMessages = conversationHistory || [{
            role: 'user' as const,
            content: userMessage
          }];
          
          const aiResponse = await claudeService.sendMessage(conversationMessages, systemPrompt);
          
          return NextResponse.json({
            success: true,
            response: aiResponse,
            currentChunk: null,
            sessionCompleted: false,
            openEndedMode: true
          });
        }
        
        // Structured conversation is enabled - use chunk-based flow
        const contentPrompt = await educationalSessionService.getSystemPrompt('content');
        const systemPrompt = contentPrompt?.content || 'You are delivering educational content about financial planning.';
        const useContentPrompt = true;

        // Process the conversation through Claude
        let aiResponse: string;
        
        try {
          // Determine if we should deliver chunk content or respond to Q&A
          const sessionResponses = await educationalSessionService.getSessionResponses(convSessionId);
          const currentChunkResponses = sessionResponses.filter(r => r.chunkId === convCurrentChunk.id);
          
          if (currentChunkResponses.length === 0) {
            // First interaction for this chunk - return chunk content directly (no Claude call needed)
            if (useContentPrompt) {
              // Structured mode: return chunk content and question directly
              const processedContent = await educationalSessionService.processChunkContent(
                convSessionId,
                convCurrentChunk.content,
                convSession.personalizationEnabled
              );
              
              // Return chunk content directly with question - no Claude API call needed
              aiResponse = `${processedContent}\n\n${convCurrentChunk.question}`;
            } else {
              // Non-educational mode: use QA prompt for open conversation
              const conversationMessages = conversationHistory || [{
                role: 'user' as const,
                content: userMessage
              }];
              
              aiResponse = await claudeService.sendMessage(conversationMessages, systemPrompt);
            }
          } else {
            // User is responding to the chunk question
            if (useContentPrompt) {
              // Educational mode: structured flow
              if (convSession.personalizationEnabled) {
                // Use QA prompt for personalized conversation within educational flow
                const qaPrompt = await educationalSessionService.getSystemPrompt('qa');
                const qaSystemPrompt = qaPrompt?.content || 'You are a helpful financial advisor assistant.';
                const messages = conversationHistory || [];
                aiResponse = await claudeService.sendMessage(messages, qaSystemPrompt);
              } else {
                // Simple acknowledgment and move to next chunk
                aiResponse = "Thank you for your response. Let's move on to the next topic.";
              }
            } else {
              // Non-educational mode: continue open conversation with QA prompt
              const messages = conversationHistory || [{
                role: 'user' as const,
                content: userMessage
              }];
              aiResponse = await claudeService.sendMessage(messages, systemPrompt);
            }
            
            // Save the user response and AI response
            await educationalSessionService.saveChunkResponse(
              convSessionId,
              convCurrentChunk.id,
              userMessage,
              aiResponse
            );
            
            // Only advance to next chunk in educational mode
            if (useContentPrompt) {
              const hasNextChunk = await educationalSessionService.advanceToNextChunk(convSessionId);
              
              if (hasNextChunk) {
                const nextChunk = await educationalSessionService.getCurrentChunk(convSessionId);
                if (nextChunk) {
                  const nextContent = await educationalSessionService.processChunkContent(
                    convSessionId,
                    nextChunk.content,
                    convSession.personalizationEnabled
                  );
                  
                  // Create enhanced system prompt for next chunk
                  const nextEnhancedSystemPrompt = `${systemPrompt}

CURRENT EDUCATIONAL CONTENT TO DELIVER:
${nextContent}

QUESTION TO ASK AFTER CONTENT:
${nextChunk.question}

Now deliver this content in your warm, conversational style and end with the question.`;
                  
                  const nextContentMessages = [{
                    role: 'user' as const,
                    content: 'Please continue with the next topic.'
                  }];
                  
                  const nextChunkResponse = await claudeService.sendMessage(nextContentMessages as any, nextEnhancedSystemPrompt);
                  aiResponse += `\n\n---\n\n${nextChunkResponse}`;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing conversation:', error);
          aiResponse = "I apologize, but I encountered an error processing your message. Let's continue with the educational content.";
        }

        return NextResponse.json({
          success: true,
          response: aiResponse,
          currentChunk: convCurrentChunk,
          sessionCompleted: await educationalSessionService.isSessionCompleted(convSessionId),
        });

      case 'advance_chunk':
        // Mark current chunk as delivered and advance to next chunk
        // Used when ElevenLabs delivers firstMessage or other non-webhook deliveries
        const { sessionId: advanceSessionId } = data;
        if (!advanceSessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        console.log('🔧 [ADVANCE-CHUNK] Advancing chunk for session:', advanceSessionId);
        const hasNext = await educationalSessionService.advanceToNextChunk(advanceSessionId);
        const advancedSession = await educationalSessionService.getSession(advanceSessionId);
        
        console.log('📊 [ADVANCE-CHUNK] Advanced session state:', {
          sessionId: advanceSessionId,
          newChunkIndex: advancedSession?.currentChunkIndex,
          hasNextChunk: hasNext,
          completed: advancedSession?.completed
        });

        return NextResponse.json({
          success: true,
          hasNextChunk: hasNext,
          newChunkIndex: advancedSession?.currentChunkIndex,
          completed: advancedSession?.completed
        });

      case 'get_session_state':
        const { sessionId: stateSessionId } = data;
        if (!stateSessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        const sessionState = await educationalSessionService.getSessionState(stateSessionId);
        
        if (!sessionState) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          sessionState,
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Educational session API error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const sessionState = await educationalSessionService.getSessionState(sessionId);
    
    if (!sessionState) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionState,
    });
  } catch (error) {
    console.error('Error fetching session state:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session state' },
      { status: 500 }
    );
  }
}