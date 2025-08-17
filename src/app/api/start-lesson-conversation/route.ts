import { NextRequest, NextResponse } from 'next/server';
import { lessonService } from '@/lib/lesson-service';
import { db } from '@/lib/database';
import * as schema from '@/lib/database/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { lessonId, sessionId } = await request.json();

    if (!lessonId || !sessionId) {
      return NextResponse.json(
        { error: 'lessonId and sessionId are required' },
        { status: 400 }
      );
    }

    // Get the lesson
    const lesson = await lessonService.getLesson(lessonId);
    if (!lesson) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      );
    }

    // Get user session
    const userSession = await lessonService.getUserSession(sessionId);
    if (!userSession) {
      return NextResponse.json(
        { error: 'User session not found' },
        { status: 404 }
      );
    }

    // Get lesson-specific prompt or fall back to general Q&A prompt
    let systemPrompt = '';
    
    // First try to get lesson-specific prompt
    const lessonPrompts = await db
      .select()
      .from(schema.systemPrompts)
      .where(
        and(
          eq(schema.systemPrompts.type, 'lesson_qa'),
          eq(schema.systemPrompts.lessonId, lessonId),
          eq(schema.systemPrompts.active, true)
        )
      )
      .limit(1);

    if (lessonPrompts.length > 0) {
      systemPrompt = lessonPrompts[0].content;
    } else {
      // Fall back to general Q&A prompt
      const generalPrompts = await db
        .select()
        .from(schema.systemPrompts)
        .where(
          and(
            eq(schema.systemPrompts.type, 'qa'),
            eq(schema.systemPrompts.active, true)
          )
        )
        .limit(1);
      
      if (generalPrompts.length > 0) {
        systemPrompt = generalPrompts[0].content;
      } else {
        return NextResponse.json(
          { error: 'No system prompt available' },
          { status: 500 }
        );
      }
    }

    // Create enhanced prompt with lesson context
    const enhancedPrompt = `${systemPrompt}

LESSON CONTEXT:
- Lesson Title: ${lesson.title}
- Video Summary: ${lesson.videoSummary}
- Initial Question: ${lesson.question}

Use this context to provide relevant, personalized responses about the lesson content. Reference the video content when appropriate and help the user understand and apply the concepts discussed.`;

    // Get admin settings for voice configuration
    const adminSettings = await db
      .select()
      .from(schema.adminSettings)
      .limit(1);

    const voiceId = adminSettings.length > 0 
      ? adminSettings[0].voiceId 
      : 'pNInz6obpgDQGcFmaJgB'; // Default voice

    // Start ElevenLabs conversation using the existing API pattern
    const conversationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/elevenlabs-conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstMessage: lesson.question,
        voiceId: voiceId,
        voiceSettings: {
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.4,
          use_speaker_boost: true
        }
      })
    });

    if (!conversationResponse.ok) {
      const errorData = await conversationResponse.json();
      return NextResponse.json(
        { error: errorData.error || 'Failed to start conversation' },
        { status: 500 }
      );
    }

    const conversationData = await conversationResponse.json();

    // Create lesson conversation record
    const lessonConversation = await lessonService.createLessonConversation(
      sessionId,
      lessonId,
      conversationData.conversationId
    );

    return NextResponse.json({
      success: true,
      conversationId: conversationData.conversationId,
      conversationUrl: conversationData.conversationUrl,
      lessonConversation: lessonConversation,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        question: lesson.question
      }
    });

  } catch (error) {
    console.error('Start lesson conversation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start lesson conversation'
      },
      { status: 500 }
    );
  }
}