import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getClaudeService } from '@/lib/claude-enhanced';
import { Message } from '@/types';
import { sessionManager, SessionData } from '@/lib/elevenlabs-session-manager';
import { educationalSessionService } from '@/lib/educational-session';
import { initializeDatabase } from '@/lib/database';

// ElevenLabs webhook request format (from FTherapy reference)
interface ElevenLabsWebhookRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  variables?: {
    conversation_id?: string;
    session_id?: string;
    current_topic?: string;
    [key: string]: any;
  };
}

// ElevenLabs expected response format
interface ElevenLabsWebhookResponse {
  content: string;
  variables?: Record<string, any>;
}

// Financial advisor conversation topics
const CONVERSATION_TOPICS = [
  'introduction',
  'financial_goals', 
  'current_situation',
  'investment_experience',
  'risk_tolerance',
  'concerns',
  'planning',
  'summary'
];

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

// Generate unique request ID for tracking
function generateRequestId(): string {
  return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Build conversation context from messages
function buildConversationContext(messages: Array<{ role: string; content: string }>): string {
  return messages
    .filter(msg => msg.role !== 'system')
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');
}

// Webhook signature verification (optional for development)
function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  const signature = request.headers.get('elevenlabs-signature');
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) {
    console.warn('Missing webhook signature or secret');
    return process.env.NODE_ENV !== 'production'; // Allow in development
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  try {
    await ensureDatabase();
    console.log(`[${requestId}] ElevenLabs webhook request started`);
    
    // Parse the webhook request body
    const body: ElevenLabsWebhookRequest = await request.json();
    const { messages, variables = {} } = body;
    
    // Extract the last user message
    const userMessage = messages[messages.length - 1];
    
    // Validate we have a user message to respond to
    if (!userMessage || userMessage.role !== 'user') {
      console.log(`[${requestId}] No user message found, returning default response`);
      return NextResponse.json({
        content: "I didn't catch that. Could you please repeat?",
        variables
      });
    }
    
    const userInput = userMessage.content;
    console.log(`[${requestId}] User input: ${userInput.substring(0, 100)}...`);
    
    // Resolve session with retry logic
    const sessionInfo = await sessionManager.resolveSessionWithRetry();
    
    if (!sessionInfo) {
      console.warn(`[${requestId}] Could not resolve session, creating new one`);
      // Create a new session if none exists
      const newSession: SessionData = {
        sessionId: `session_${Date.now()}`,
        conversationId: variables.conversation_id,
        registeredAt: new Date().toISOString(),
        messages: []
      };
      await sessionManager.registerSession(newSession);
    }
    
    const session = sessionInfo || await sessionManager.getLatestSession();
    
    if (!session) {
      console.error(`[${requestId}] Failed to get or create session`);
      return NextResponse.json({
        content: "I'm having trouble connecting. Please try refreshing the page and starting a new conversation.",
        variables
      });
    }
    
    // Store user message in session
    await sessionManager.addMessage(session.sessionId, {
      timestamp: new Date().toISOString(),
      message: userInput,
      speaker: 'user'
    });
    
    // Update session activity
    await sessionManager.updateSessionActivity(session.sessionId);
    
    // Build conversation context
    const conversationContext = buildConversationContext(messages);
    
    // Check for educational session using conversation_id
    console.log(`[${requestId}] Checking for educational session...`);
    
    // Get conversation_id from ElevenLabs variables
    const conversationId = variables.conversation_id;
    let educationalSession = null;
    
    if (conversationId) {
      console.log(`[${requestId}] Using conversation_id: ${conversationId}`);
      // Use conversation_id directly as educational session ID
      educationalSession = await educationalSessionService.getSession(conversationId);
      
      if (educationalSession) {
        console.log(`[${requestId}] Found educational session for conversation: ${conversationId}`);
      } else {
        console.log(`[${requestId}] No educational session found for conversation: ${conversationId}, using open-ended mode`);
      }
    } else {
      console.log(`[${requestId}] No conversation_id provided, using open-ended mode`);
    }
    
    let aiResponse: string;
    let updatedVariables = { ...variables };
    
    if (educationalSession) {
      // Use educational session processing for structured conversations
      console.log(`[${requestId}] Processing via educational session API...`);
      
      try {
        // Convert ElevenLabs messages to conversation history format
        const conversationHistory = messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        }));
        
        // Call educational session processing
        const response = await fetch(`${request.nextUrl.origin}/api/educational-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'process_conversation',
            sessionId: conversationId, // Use conversation_id directly
            userMessage: userInput,
            conversationHistory: conversationHistory
          })
        });
        
        if (!response.ok) {
          throw new Error(`Educational session API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Educational session processing failed');
        }
        
        aiResponse = data.response;
        
        // Update variables with educational session context
        updatedVariables = {
          ...variables,
          conversation_id: conversationId,
          current_chunk: data.currentChunk?.id,
          session_completed: data.sessionCompleted || false,
          structured_mode: true,
          conversation_mode: 'structured'
        };
        
        console.log(`[${requestId}] Educational session response generated`);
        
      } catch (educationalError) {
        console.error(`[${requestId}] Educational session processing failed:`, educationalError);
        // Fall back to Claude processing
        console.log(`[${requestId}] Falling back to Claude (open-ended mode)...`);
        const claudeService = getClaudeService();
        
        try {
          const formattedMessages: Message[] = messages.map((msg, index) => ({
            id: `msg_${index}`,
            content: msg.content,
            sender: msg.role === 'user' ? 'user' : 'assistant',
            timestamp: new Date()
          }));
          
          const response = await claudeService.sendMessageWithContext(formattedMessages, userInput);
          aiResponse = response.response;
        } catch (claudeError) {
          console.error(`[${requestId}] Claude processing also failed:`, claudeError);
          aiResponse = "I apologize, but I'm having technical difficulties. Please try again.";
        }
        
        updatedVariables = {
          ...variables,
          structured_mode: false,
          conversation_mode: 'open-ended'
        };
      }
    } else {
      // Use Claude for open-ended conversation (no educational session)
      console.log(`[${requestId}] Processing via Claude (open-ended mode)...`);
      const claudeService = getClaudeService();
      
      try {
        // Convert messages to our Message format for Claude
        const formattedMessages: Message[] = messages.map((msg, index) => ({
          id: `msg_${index}`,
          content: msg.content,
          sender: msg.role === 'user' ? 'user' : 'assistant',
          timestamp: new Date()
        }));
        
        // Generate response with context
        const response = await claudeService.sendMessageWithContext(formattedMessages, userInput);
        aiResponse = response.response;
        
        // Update variables for open-ended mode
        updatedVariables = {
          ...variables,
          structured_mode: false,
          conversation_mode: 'open-ended'
        };
        
      } catch (claudeError) {
        console.error(`[${requestId}] Claude processing failed:`, claudeError);
        throw claudeError;
      }
    }
      
    // Store assistant response in session
    await sessionManager.addMessage(session.sessionId, {
      timestamp: new Date().toISOString(),
      message: aiResponse,
      speaker: 'agent'
    });
    
    // Determine next topic in conversation flow (for compatibility)
    const currentTopic = variables.current_topic || 'introduction';
    const isStructuredMode = educationalSession !== null;
    const nextTopic = isStructuredMode ? 
      (updatedVariables.session_completed ? 'summary' : currentTopic) :
      determineNextTopic(currentTopic, userInput, messages);
    
    // Log completion
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Webhook completed in ${duration}ms (mode: ${isStructuredMode ? 'structured' : 'open-ended'})`);
    console.log(`[${requestId}] Response: ${aiResponse.substring(0, 100)}...`);
    
    // Return response in ElevenLabs expected format with enhanced variables
    return NextResponse.json({
      content: aiResponse,
      variables: {
        ...updatedVariables,
        current_topic: nextTopic,
        session_id: session.sessionId,
        message_count: messages.length + 1
      }
    });
      
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Webhook error after ${duration}ms:`, error);
    
    // Return error response in expected format
    return NextResponse.json({
      content: "I apologize, but I'm having a technical difficulty. Could you please try again?",
      variables: {}
    }, { status: 200 }); // Return 200 even on error to prevent ElevenLabs retry loop
  }
}

// Helper function to determine next topic
function determineNextTopic(currentTopic: string, userInput: string, messages: any[]): string {
  // Only progress if user provides substantive answer (FTherapy pattern)
  if (userInput.trim().length <= 10) {
    return currentTopic;
  }
  
  const currentIndex = CONVERSATION_TOPICS.indexOf(currentTopic);
  
  // Check for topic triggers in user input
  const lowerInput = userInput.toLowerCase();
  
  if (lowerInput.includes('goodbye') || lowerInput.includes('thank you') || lowerInput.includes('bye')) {
    return 'summary';
  }
  
  // Normal progression through topics
  if (currentIndex >= 0 && currentIndex < CONVERSATION_TOPICS.length - 1) {
    // Check if we have enough conversation before moving to summary
    if (CONVERSATION_TOPICS[currentIndex + 1] === 'summary' && messages.length < 10) {
      return currentTopic; // Stay on current topic if not enough conversation
    }
    return CONVERSATION_TOPICS[currentIndex + 1];
  }
  
  return currentTopic;
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'ElevenLabs Webhook Handler',
      description: 'Processes conversation webhooks from ElevenLabs',
      supportedTypes: [
        'conversation.message',
        'conversation.status',
        'conversation.error'
      ],
      features: [
        'Conversation flow management',
        'Dynamic response generation',
        'Tool integration triggers',
        'Signature verification'
      ]
    },
    { status: 200 }
  );
}