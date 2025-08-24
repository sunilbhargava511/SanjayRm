import { NextResponse } from 'next/server';
import { ClaudeArtifactProcessor, claudeArtifactUtils } from '@/lib/claude-artifact-processor';

export async function POST(request: Request) {
  try {
    const { url, action } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate that it's a Claude artifact URL
    if (!claudeArtifactUtils.isClaudeUrl(url)) {
      return NextResponse.json(
        { success: false, error: 'URL is not a valid Claude artifact URL' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'fetch':
        try {
          const artifact = await ClaudeArtifactProcessor.fetchArtifactContent(url);
          if (!artifact) {
            return NextResponse.json(
              { success: false, error: 'Could not fetch artifact content' },
              { status: 404 }
            );
          }

          return NextResponse.json({
            success: true,
            artifact: {
              id: artifact.id,
              title: artifact.title,
              contentType: artifact.contentType,
              dependencies: artifact.dependencies || []
            }
          });
        } catch (error) {
          return NextResponse.json(
            { success: false, error: 'Failed to fetch artifact' },
            { status: 500 }
          );
        }

      case 'process':
        try {
          const artifact = await ClaudeArtifactProcessor.fetchArtifactContent(url);
          if (!artifact) {
            return NextResponse.json(
              { success: false, error: 'Could not fetch artifact content' },
              { status: 404 }
            );
          }

          const processed = ClaudeArtifactProcessor.processArtifactForDeployment(artifact);
          
          return NextResponse.json({
            success: true,
            processed: {
              title: processed.title,
              htmlContent: processed.htmlContent,
              hasErrors: processed.hasErrors,
              errors: processed.errors,
              warnings: processed.warnings,
              dependencies: processed.dependencies,
              safeFilename: ClaudeArtifactProcessor.generateSafeFilename(
                processed.title, 
                artifact.id
              )
            }
          });
        } catch (error) {
          return NextResponse.json(
            { 
              success: false, 
              error: error instanceof Error ? error.message : 'Failed to process artifact' 
            },
            { status: 500 }
          );
        }

      case 'validate':
        try {
          const artifactId = claudeArtifactUtils.extractId(url);
          if (!artifactId) {
            return NextResponse.json(
              { success: false, error: 'Could not extract artifact ID from URL' },
              { status: 400 }
            );
          }

          return NextResponse.json({
            success: true,
            validation: {
              isValid: true,
              isClaudeArtifact: true,
              artifactId,
              canProcess: true
            }
          });
        } catch (error) {
          return NextResponse.json(
            { success: false, error: 'Failed to validate URL' },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Artifact processing error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url) {
    return NextResponse.json(
      { success: false, error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  // Quick validation endpoint
  const isClaudeUrl = claudeArtifactUtils.isClaudeUrl(url);
  const artifactId = claudeArtifactUtils.extractId(url);

  return NextResponse.json({
    success: true,
    validation: {
      isValid: /^https?:\/\/.+/.test(url),
      isClaudeArtifact: isClaudeUrl,
      artifactId: artifactId,
      canProcess: isClaudeUrl && artifactId !== null
    }
  });
}