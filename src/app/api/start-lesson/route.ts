import { NextRequest, NextResponse } from 'next/server';
import { lessonService } from '@/lib/lesson-service';

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

    // If lesson has a start message, prepare it for TTS (audio generation will be handled client-side)
    if (lesson.startMessage) {
      response.startMessage = {
        text: lesson.startMessage,
        audioUrl: null // Audio generation will be handled by TTSPlayer component
      };
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