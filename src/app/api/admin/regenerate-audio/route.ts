import { NextResponse } from 'next/server';
import { openingMessageService } from '@/lib/opening-message-service';
import { audioCacheService } from '@/lib/audio-cache-service';

export async function POST(request: Request) {
  try {
    const { messageId, all } = await request.json();

    if (all) {
      // Regenerate all audio
      console.log('[Audio API] Regenerating all cached audio...');
      const result = await openingMessageService.regenerateAllAudio();
      
      return NextResponse.json({
        success: true,
        message: `Regenerated audio for ${result.succeeded}/${result.total} messages. ${result.failed} failed.`,
        stats: result
      });
    } else if (messageId) {
      // Regenerate specific message audio
      console.log('[Audio API] Regenerating audio for message:', messageId);
      await openingMessageService.regenerateAudio(messageId);
      
      return NextResponse.json({
        success: true,
        message: `Audio regenerated successfully for message ${messageId}`
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing messageId or all parameter' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Audio API] Error regenerating audio:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to regenerate audio'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const messageId = url.searchParams.get('messageId');

    if (messageId) {
      // Check if specific message needs regeneration
      const needsRegen = await openingMessageService.needsAudioRegeneration(messageId);
      
      return NextResponse.json({
        success: true,
        messageId,
        needsRegeneration: needsRegen
      });
    } else {
      // Get cache statistics
      const stats = await openingMessageService.getAudioCacheStats();
      
      return NextResponse.json({
        success: true,
        statistics: stats
      });
    }
  } catch (error) {
    console.error('[Audio API] Error checking audio status:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check audio status'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const daysOld = parseInt(url.searchParams.get('daysOld') || '30');

    // Clear old cached audio
    console.log('[Audio API] Clearing cached audio older than', daysOld, 'days');
    const cleared = await audioCacheService.clearOldCache(daysOld);
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${cleared} old cache entries`,
      clearedEntries: cleared
    });
  } catch (error) {
    console.error('[Audio API] Error clearing cache:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clear cache'
      },
      { status: 500 }
    );
  }
}