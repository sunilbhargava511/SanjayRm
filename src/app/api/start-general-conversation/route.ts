import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/admin-service';
import { getClaudeService } from '@/lib/claude-enhanced';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting general conversation with ElevenLabs...');
    
    // 1. Get the general Q&A prompt from database
    const prompts = await adminService.getAllSystemPrompts();
    const generalQAPrompt = prompts.find(p => p.type === 'qa' && !p.lessonId);
    
    if (!generalQAPrompt) {
      return NextResponse.json(
        { 
          error: 'General Q&A prompt not found',
          details: 'Please configure a general Q&A prompt in the admin panel' 
        },
        { status: 500 }
      );
    }

    // 2. Get voice settings from admin
    const settings = await adminService.getAdminSettings();
    const voiceId = settings?.voiceId || 'pNInz6obpgDQGcFmaJgB';
    
    // 3. Pass the prompt to Claude to generate the first message
    const claudeService = getClaudeService();
    
    const introPrompt = `${generalQAPrompt.content}

This is the start of a new financial counseling conversation. Generate a warm, welcoming introduction message that:
- Introduces you as Sanjay, an AI financial advisor
- Creates a comfortable, safe space for discussion
- Invites the user to share what's on their mind financially
- Keep it under 100 words
- Write for voice synthesis (avoid symbols, spell out numbers)

Generate just the introduction message, nothing else.`;

    const firstMessage = await claudeService.sendMessage([{
      id: 'intro_request',
      sender: 'user',
      content: introPrompt,
      timestamp: new Date()
    }], introPrompt);

    console.log('Generated first message from Claude:', firstMessage.substring(0, 100) + '...');

    // 4. Create ElevenLabs conversation with the Claude-generated first message
    const elevenlabsResponse = await fetch(`${process.env.NODE_ENV === 'production' ? 'https://thegoldenpath.fly.dev' : 'http://localhost:3002'}/api/elevenlabs-conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstMessage: firstMessage.trim(),
        voiceId: voiceId,
        voiceSettings: {
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.4,
          use_speaker_boost: true,
          speed: 0.85
        }
      })
    });

    if (!elevenlabsResponse.ok) {
      const errorData = await elevenlabsResponse.json();
      console.error('Failed to create ElevenLabs conversation:', errorData);
      return NextResponse.json(
        { 
          error: 'Failed to create voice conversation',
          details: errorData.error || 'ElevenLabs API error'
        },
        { status: 500 }
      );
    }

    const conversationData = await elevenlabsResponse.json();
    
    console.log('Successfully created general conversation:', {
      conversationId: conversationData.conversationId,
      firstMessageLength: firstMessage.length
    });

    // 5. Store the prompt ID for use in webhook callbacks
    // We'll store this in the conversation metadata or pass it through the webhook
    return NextResponse.json({
      success: true,
      conversation: {
        signedUrl: conversationData.signedUrl,
        conversationId: conversationData.conversationId,
        expiresAt: conversationData.expiresAt,
        promptId: generalQAPrompt.id, // Store for webhook use
        type: 'general_qa'
      },
      firstMessage: firstMessage.trim(),
      voiceSettings: {
        voiceId,
        settings: conversationData.overrides?.voiceSettings
      }
    });

  } catch (error) {
    console.error('Error starting general conversation:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to start conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'General Conversation Starter Endpoint',
    description: 'POST to start a general financial counseling conversation with ElevenLabs',
    flow: [
      '1. Retrieves general Q&A prompt from database',
      '2. Passes prompt to Claude to generate welcoming first message',
      '3. Creates ElevenLabs conversation with Claude-generated intro',
      '4. Returns conversation details for frontend integration'
    ],
    webhookIntegration: 'Use promptId in webhook to maintain context',
    requirements: [
      'General Q&A prompt configured in admin panel',
      'ElevenLabs API credentials',
      'Claude API credentials'
    ]
  });
}