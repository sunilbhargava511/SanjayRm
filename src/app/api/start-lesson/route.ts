import { NextRequest, NextResponse } from 'next/server';
import { lessonService } from '@/lib/lesson-service';
import { ElevenLabsService } from '@/lib/elevenlabs';

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

    // Get or create user session
    let userSession = await lessonService.getUserSession(sessionId);
    if (!userSession) {
      userSession = await lessonService.createUserSession();
    }

    // Update current lesson
    await lessonService.updateUserSession(sessionId, {
      currentLessonId: lessonId
    });

    const response: any = {
      success: true,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        videoUrl: lesson.videoUrl,
        hasStartMessage: !!lesson.startMessage
      }
    };

    // If lesson has a start message, generate TTS audio
    if (lesson.startMessage) {
      try {
        const elevenLabs = new ElevenLabsService();
        const audioUrl = await elevenLabs.generateSpeech(lesson.startMessage);
        
        response.startMessage = {
          text: lesson.startMessage,
          audioUrl: audioUrl
        };
      } catch (error) {
        console.error('TTS generation failed:', error);
        // Return lesson without audio if TTS fails
        response.startMessage = {
          text: lesson.startMessage,
          audioUrl: null,
          error: 'TTS generation failed'
        };
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Start lesson error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start lesson'
      },
      { status: 500 }
    );
  }
}