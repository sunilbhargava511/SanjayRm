import { NextRequest, NextResponse } from 'next/server';
import { getClaudeService } from '@/lib/claude-enhanced';
import { educationalSessionService } from '@/lib/educational-session';
import { sessionManager } from '@/lib/elevenlabs-session-manager';
import fs from 'fs';
import path from 'path';

/**
 * OpenAI-Compatible Chat Completions API for ElevenLabs Integration
 * This endpoint provides an OpenAI-compatible interface while using Anthropic Claude
 */

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
}

interface OpenAICompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

interface SessionData {
  sessionId: string;
  therapistId: string;
  frontendSessionId: string;
  registeredAt: string;
  lastActivity?: string;
}

// Session resolution following FTherapy pattern (guide lines 624-647)
async function resolveSessionId(maxRetries: number = 3): Promise<{ sessionId: string; therapistId: string } | null> {
  const SESSION_REGISTRY_DIR = path.join(process.cwd(), '.sessions');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const latestSessionPath = path.join(SESSION_REGISTRY_DIR, 'registry_latest.json');
      
      if (fs.existsSync(latestSessionPath)) {
        const data = await fs.promises.readFile(latestSessionPath, 'utf8');
        const latestSession: SessionData = JSON.parse(data);
        
        if (latestSession) {
          console.log(`[Session Resolution] Found session: ${latestSession.frontendSessionId} (attempt ${attempt})`);
          return {
            sessionId: latestSession.frontendSessionId,
            therapistId: latestSession.therapistId
          };
        }
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      }
    } catch (error) {
      console.error(`Error resolving session ID (attempt ${attempt}):`, error);
      if (attempt === maxRetries) {
        return null;
      }
    }
  }
  
  return null;
}

// OpenAI-compatible STREAMING endpoint for ElevenLabs (FTherapy Pattern)
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // Debug: Incoming request
  console.log('🎯 [CHAT-COMPLETIONS] Processing request');
  
  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json();
        
        // Extract conversation_id from the request for educational session lookup
        const headers = Object.fromEntries(request.headers.entries());
        
        // Try multiple possible locations for conversation_id
        const conversationId = headers['conversation_id'] ||  // NEW: Check for the header you just added!
                              headers['x-conversation-id'] || 
                              headers['x-elevenlabs-conversation-id'] ||
                              body.conversation_id || 
                              body.variables?.conversation_id ||
                              body.metadata?.conversation_id;
        
        // Debug: Show all possible sources to find where conversation_id is located
        console.log('🔍 [SESSION-DEBUG] Searching for conversation_id:', {
          fromHeaders: {
            'conversation_id': headers['conversation_id'],  // NEW: Show the header value
            'x-conversation-id': headers['x-conversation-id'],
            'x-elevenlabs-conversation-id': headers['x-elevenlabs-conversation-id']
          },
          fromBody: {
            conversation_id: body.conversation_id,
            'variables.conversation_id': body.variables?.conversation_id,
            'metadata.conversation_id': body.metadata?.conversation_id
          },
          found: conversationId
        });

        // Try to resolve session using FTherapy pattern (optional for single conversation system)
        const sessionInfo = await resolveSessionId();
        if (sessionInfo) {
          console.log(`✅ Session resolved: ${sessionInfo.sessionId} (${sessionInfo.therapistId})`);
        } else {
          console.log('⚠️ [SESSION-DEBUG] Session resolution failed, will try direct conversation_id lookup');
        }
        
        // Check for educational session using conversation_id or session metadata
        let educationalSession = null;
        let useStructuredMode = false;
        let educationalSessionId = null;
        
        // FIRST: Try to use conversation_id directly if available (from ElevenLabs header)
        if (conversationId) {
          console.log('🎯 [SESSION-DEBUG] Conversation ID found! Attempting to use as educational session ID:', conversationId);
          
          // Try to load educational session using conversation_id as the key
          educationalSession = await educationalSessionService.getSession(conversationId);
          
          if (educationalSession) {
            console.log('✅ [SESSION-DEBUG] Educational session found using conversation_id!', {
              id: educationalSession.id,
              currentChunkIndex: educationalSession.currentChunkIndex,
              completed: educationalSession.completed
            });
            educationalSessionId = conversationId;
            useStructuredMode = true;
          } else {
            console.log('⚠️ [SESSION-DEBUG] No educational session found for conversation_id:', conversationId);
          }
        }
        
        // FALLBACK: If no conversation_id or no educational session found, try session metadata
        if (!educationalSession && sessionInfo && sessionInfo.sessionId) {
          console.log('🔍 [SESSION-DEBUG] Falling back to session metadata lookup...');
          
          try {
            const latestSession = await sessionManager.getLatestSession();
            if (latestSession && latestSession.metadata?.educational_session_id) {
              educationalSessionId = latestSession.metadata.educational_session_id;
              console.log('🔍 [SESSION-DEBUG] Found educational_session_id in metadata:', educationalSessionId);
              
              educationalSession = await educationalSessionService.getSession(educationalSessionId);
              if (educationalSession) {
                console.log('✅ [SESSION-DEBUG] Educational session found via metadata:', {
                  id: educationalSession.id,
                  currentChunkIndex: educationalSession.currentChunkIndex,
                  completed: educationalSession.completed
                });
                useStructuredMode = true;
              } else {
                console.log('⚠️ [SESSION-DEBUG] Educational session not found in database');
              }
            } else {
              console.log('🔍 [SESSION-DEBUG] No educational_session_id in session metadata');
            }
          } catch (error) {
            console.log('🔍 [SESSION-DEBUG] Session lookup failed:', error instanceof Error ? error.message : 'Unknown error');
          }
        }
        
        if (!educationalSession) {
          console.log('❌ [SESSION-DEBUG] No educational session available - will use open-ended mode');
          
          // If we have conversation_id but no session, this might be a timing issue
          if (conversationId) {
            console.log('🔧 [SESSION-DEBUG] Have conversation_id but no session - might be during transition period');
          }
        }
        
        console.log('🔍 [SESSION-DEBUG] Structured mode enabled:', useStructuredMode);
        
        // Check if streaming is requested
        const isStreaming = body.stream !== false;
        
        // Get the last user message
        const messages = body.messages || [];
        const lastMessage = messages[messages.length - 1];
        
        // Default response
        let responseContent = "Hello! I'm Sanjay, your AI financial advisor. I'm here to help you build a healthier relationship with money and work toward your financial goals. What would you like to talk about today?";
        
        if (lastMessage && lastMessage.role === 'user') {
          const userInput = lastMessage.content;
          
          try {
            if (useStructuredMode && educationalSession && educationalSessionId) {
              console.log('🎯 [STRUCTURED] Using educational session for response generation');
              
              // Use educational session service directly (no HTTP call needed since we're already in the API)
              const conversationHistory = messages.map((msg: any) => ({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content
              }));
              
              console.log('🔍 [STRUCTURED] Processing conversation directly with educational session service');
              
              // Get current chunk and session
              const currentChunk = await educationalSessionService.getCurrentChunk(educationalSessionId);
              const currentSession = await educationalSessionService.getSession(educationalSessionId);
              
              // DEBUG: Show initial database state
              console.log('📊 [DATABASE-STATE] Initial educational session record:', {
                id: currentSession?.id,
                currentChunkIndex: currentSession?.currentChunkIndex,
                completed: currentSession?.completed,
                personalizationEnabled: currentSession?.personalizationEnabled,
                createdAt: currentSession?.createdAt,
                updatedAt: currentSession?.updatedAt
              });
              
              console.log('📊 [DATABASE-STATE] Current chunk details:', {
                chunkId: currentChunk?.id,
                chunkIndex: currentChunk?.orderIndex,
                chunkTitle: currentChunk?.title,
                hasContent: !!currentChunk?.content,
                contentLength: currentChunk?.content?.length,
                hasQuestion: !!currentChunk?.question
              });
              
              if (!currentChunk) {
                console.log('🎯 [STRUCTURED] No more chunks - session completed');
                responseContent = "Thank you for completing the educational program! Your comprehensive report has been generated and is available for download.";
              } else {
                console.log('🎯 [STRUCTURED] Processing chunk:', currentChunk.id, 'at index:', currentSession?.currentChunkIndex);
                
                // NEW LOGIC: All webhook calls are user responses since chunk 1 already delivered by ElevenLabs firstMessage
                // The frontend advances the session after generating firstMessage, so currentChunkIndex > 0
                const allSessionResponses = await educationalSessionService.getSessionResponses(educationalSessionId);
                
                // DEBUG: Show session response analysis
                console.log('📊 [DATABASE-STATE] Session responses analysis:', {
                  currentChunkIndex: currentSession?.currentChunkIndex,
                  totalResponses: allSessionResponses.length,
                  note: 'Chunk 1 already delivered by ElevenLabs firstMessage',
                  responsesPerChunk: allSessionResponses.reduce((acc, response) => {
                    acc[response.chunkId] = (acc[response.chunkId] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                });
                
                // All webhook calls are user responses to previously delivered chunks
                console.log('🎯 [STRUCTURED] User responding to chunk, saving response and advancing...');
                
                const acknowledgment = currentSession?.personalizationEnabled 
                  ? "Thank you for sharing that. Your response helps me understand your financial situation better."
                  : "Thank you for your response.";
                
                // Save the user's response to the current chunk
                console.log('💾 [DATABASE-UPDATE] Saving user response:', {
                  sessionId: educationalSessionId,
                  chunkId: currentChunk.id,
                  userResponsePreview: userInput.substring(0, 100) + '...',
                  aiResponsePreview: acknowledgment.substring(0, 50) + '...'
                });
                
                await educationalSessionService.saveChunkResponse(
                  educationalSessionId,
                  currentChunk.id,
                  userInput,
                  acknowledgment
                );
                
                // Always try to advance to the next chunk
                const hasNextChunk = await educationalSessionService.advanceToNextChunk(educationalSessionId);
                
                // DEBUG: Show database state after advancement
                const updatedSession = await educationalSessionService.getSession(educationalSessionId);
                console.log('💾 [DATABASE-UPDATE] Session state after advancement:', {
                  previousChunkIndex: currentSession?.currentChunkIndex,
                  newChunkIndex: updatedSession?.currentChunkIndex,
                  hasNextChunk: hasNextChunk,
                  sessionCompleted: updatedSession?.completed
                });
                
                if (hasNextChunk) {
                  // Get the newly current chunk (after advancing)
                  const nextChunk = await educationalSessionService.getCurrentChunk(educationalSessionId);
                  if (nextChunk) {
                    const nextContent = await educationalSessionService.processChunkContent(
                      educationalSessionId,
                      nextChunk.content,
                      currentSession?.personalizationEnabled || false
                    );
                    
                    responseContent = `${acknowledgment}\n\n---\n\n${nextContent}\n\n${nextChunk.question}`;
                    
                    // DEBUG: Show what's being returned for next chunk
                    console.log('📤 [RESPONSE-TO-ELEVENLABS] Next chunk delivery:', {
                      chunkId: nextChunk.id,
                      chunkTitle: nextChunk.title,
                      chunkIndex: nextChunk.orderIndex,
                      acknowledgmentPreview: acknowledgment.substring(0, 50) + '...',
                      contentPreview: nextContent.substring(0, 100) + '...',
                      questionPreview: nextChunk.question.substring(0, 100) + '...',
                      fullResponseLength: responseContent.length
                    });
                    
                    console.log('✅ [STRUCTURED] Delivered next chunk:', nextChunk.id, 'at index:', nextChunk.orderIndex);
                  } else {
                    responseContent = acknowledgment;
                    console.log('⚠️ [STRUCTURED] Next chunk not found after advancing');
                  }
                } else {
                  // Session completed - generate comprehensive report
                  console.log('🔧 [REPORT-GENERATION] Session completed, generating comprehensive report...');
                  
                  try {
                    // Generate report using the same pattern as educational-session API
                    const baseUrl = request.nextUrl.origin.replace('https://localhost', 'http://localhost').replace(':3001', ':3000');
                    const reportResponse = await fetch(`${baseUrl}/api/reports`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'generate',
                        sessionId: educationalSessionId,
                        options: {
                          includeResponses: true,
                          includeTimestamps: true,
                          includePersonalizationNotes: currentSession?.personalizationEnabled,
                          useBaseTemplate: true
                        }
                      })
                    });

                    if (reportResponse.ok) {
                      const reportData = await reportResponse.json();
                      console.log('✅ [REPORT-GENERATION] Report generated successfully:', {
                        reportId: reportData.reportId,
                        reportPath: reportData.reportPath
                      });
                      
                      responseContent = `${acknowledgment}\n\nCongratulations! You've completed the educational program. Your comprehensive report has been generated and is available for download.`;
                    } else {
                      console.error('❌ [REPORT-GENERATION] Report generation failed:', await reportResponse.text());
                      responseContent = `${acknowledgment}\n\nCongratulations! You've completed the educational program. Your report will be available shortly.`;
                    }
                  } catch (reportError) {
                    console.error('❌ [REPORT-GENERATION] Report generation error:', reportError);
                    responseContent = `${acknowledgment}\n\nCongratulations! You've completed the educational program. Thank you for your participation!`;
                  }
                  
                  // DEBUG: Show completion details
                  console.log('📤 [RESPONSE-TO-ELEVENLABS] Session completion:', {
                    finalAcknowledgment: acknowledgment,
                    completionMessage: "Educational program completed",
                    fullResponseLength: responseContent.length
                  });
                  
                  console.log('✅ [STRUCTURED] Educational session completed - no more chunks');
                }
                
                // DEBUG: Final summary of database state
                const finalSession = await educationalSessionService.getSession(educationalSessionId);
                console.log('📊 [DATABASE-STATE] Final session summary:', {
                  sessionId: educationalSessionId,
                  currentChunkIndex: finalSession?.currentChunkIndex,
                  completed: finalSession?.completed,
                  responseBeingSent: responseContent.substring(0, 200) + '...'
                });
              }
              
            } else {
              console.log('🔹 [OPEN-ENDED] Using Claude for response generation');
              
              // Use Claude service for open-ended conversation
              const claudeService = getClaudeService();
              const claudeMessages = messages.map((msg: any) => ({
                id: `msg_${Date.now()}`,
                content: msg.content,
                sender: msg.role === 'user' ? 'user' : 'assistant',
                timestamp: new Date()
              }));
              
              responseContent = await claudeService.sendMessage(claudeMessages);
              console.log('✅ [OPEN-ENDED] Generated Claude response');
            }
            
          } catch (error) {
            console.error('❌ Failed to generate response:', error);
            responseContent = "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.";
          }
        }
        
        // Voice settings for Sanjay (financial advisor tone)
        let voiceSettings = {
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.4,
          use_speaker_boost: true,
          speed: 0.85
        };
        
        // Adjust voice based on response sentiment (FTherapy pattern)
        if (responseContent.includes('!') || responseContent.includes('excited') || responseContent.includes('great')) {
          voiceSettings.stability = 0.4;
          voiceSettings.similarity_boost = 0.85;
          voiceSettings.style = 0.6;
        } else if (responseContent.includes('concern') || responseContent.includes('worry') || responseContent.includes('difficult')) {
          voiceSettings.stability = 0.7;
          voiceSettings.similarity_boost = 0.75;
          voiceSettings.style = 0.3;
          voiceSettings.speed = 0.8; // Slower for serious topics
        }
        
        if (isStreaming) {
          // Use working 3-chunk pattern from test app (ElevenLabs compatible)
          const completionId = `chatcmpl-${Date.now()}`;
          const created = Math.floor(Date.now() / 1000);
          const fingerprint = `fp_${Date.now().toString(36)}`;
          const model = body.model || 'claude-3-5-sonnet-20241022';
          
          // OpenAI streaming format: role chunk, content chunk, final chunk
          const roleChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created: created,
            model: model,
            system_fingerprint: fingerprint,
            choices: [
              {
                index: 0,
                delta: { role: 'assistant', content: '' },
                logprobs: null,
                finish_reason: null
              }
            ]
          };
          
          const contentChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created: created,
            model: model,
            system_fingerprint: fingerprint,
            choices: [
              {
                index: 0,
                delta: { content: responseContent },
                logprobs: null,
                finish_reason: null
              }
            ]
          };
          
          const finalChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created: created,
            model: model,
            system_fingerprint: fingerprint,
            choices: [
              {
                index: 0,
                delta: {},
                logprobs: null,
                finish_reason: 'stop'
              }
            ]
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(roleChunk)}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentChunk)}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          
        } else {
          // Non-streaming response (FTherapy pattern)
          const response: OpenAICompletionResponse = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: body.model || 'claude-3-5-sonnet-20241022',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: responseContent
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: messages.reduce((sum: number, msg: any) => sum + msg.content.length / 4, 0),
              completion_tokens: responseContent.length / 4,
              total_tokens: (messages.reduce((sum: number, msg: any) => sum + msg.content.length, 0) + responseContent.length) / 4
            }
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(response)}\n\n`));
        }
        
      } catch (error) {
        console.error('❌ Chat completions error:', error);
        
        // Only try to send error response if controller is still open
        try {
          const errorResponse: OpenAIErrorResponse = {
            error: {
              message: error instanceof Error ? error.message : 'Internal server error',
              type: 'server_error',
              code: 'internal_error'
            }
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorResponse)}\n\n`));
        } catch (controllerError) {
          // Controller might already be closed, ignore this error
          console.log('Controller already closed, cannot send error response');
        }
      }
      
      // Only close controller if it's not already closed
      try {
        controller.close();
      } catch (closeError) {
        // Controller already closed, ignore
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

export async function GET() {
  return NextResponse.json({
    message: 'ElevenLabs Webhook Endpoint',
    description: 'Handles webhooks from ElevenLabs conversations configured for /api/chat/completions',
    purpose: 'OpenAI-compatible endpoint for ElevenLabs webhook integration',
    forwards_to: '/api/webhooks/post-call',
    status: 'active'
  });
}