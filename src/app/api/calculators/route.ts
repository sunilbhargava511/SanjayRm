import { NextRequest, NextResponse } from 'next/server';
import { calculatorService } from '@/lib/calculator-service';
import { initializeDatabase } from '@/lib/database';

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const calculatorId = searchParams.get('id');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    if (calculatorId) {
      const calculator = await calculatorService.getCalculator(calculatorId);
      if (!calculator) {
        return NextResponse.json(
          { success: false, error: 'Calculator not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, calculator });
    }

    const calculators = await calculatorService.getAllCalculators(activeOnly);
    return NextResponse.json({ success: true, calculators });

  } catch (error) {
    console.error('Error fetching calculators:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch calculators' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create': {
        const { 
          name, 
          url, 
          description, 
          orderIndex, 
          calculatorType, 
          codeContent, 
          artifactUrl, 
          fileName, 
          isPublished 
        } = data;
        
        // Validate required fields
        if (!name || !description) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: name, description' },
            { status: 400 }
          );
        }

        const type = calculatorType || 'url';

        // Validate type-specific requirements
        if (type === 'url') {
          if (!url) {
            return NextResponse.json(
              { success: false, error: 'URL is required for URL-based calculators' },
              { status: 400 }
            );
          }
          if (!calculatorService.validateUrl(url)) {
            return NextResponse.json(
              { success: false, error: 'Invalid URL format' },
              { status: 400 }
            );
          }
        } else if (type === 'code') {
          if (!codeContent) {
            return NextResponse.json(
              { success: false, error: 'Code content is required for code-based calculators' },
              { status: 400 }
            );
          }
        }

        const calculator = await calculatorService.createCalculator({
          name,
          url,
          description,
          orderIndex,
          calculatorType: type,
          codeContent,
          artifactUrl,
          fileName,
          isPublished
        });

        return NextResponse.json({ 
          success: true, 
          calculator,
          message: 'Calculator created successfully' 
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in calculators POST:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'update': {
        const { calculatorId, ...updates } = data;
        
        if (!calculatorId) {
          return NextResponse.json(
            { success: false, error: 'Calculator ID is required' },
            { status: 400 }
          );
        }

        // Validate URL if provided
        if (updates.url && !calculatorService.validateUrl(updates.url)) {
          return NextResponse.json(
            { success: false, error: 'Invalid URL format' },
            { status: 400 }
          );
        }

        await calculatorService.updateCalculator(calculatorId, updates);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Calculator updated successfully' 
        });
      }

      case 'reorder': {
        const { calculatorIds } = data;
        
        if (!Array.isArray(calculatorIds)) {
          return NextResponse.json(
            { success: false, error: 'Calculator IDs must be an array' },
            { status: 400 }
          );
        }

        await calculatorService.reorderCalculators(calculatorIds);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Calculators reordered successfully' 
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in calculators PUT:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const calculatorId = searchParams.get('id');

    if (!calculatorId) {
      return NextResponse.json(
        { success: false, error: 'Calculator ID is required' },
        { status: 400 }
      );
    }

    await calculatorService.deleteCalculator(calculatorId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Calculator deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting calculator:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete calculator' },
      { status: 500 }
    );
  }
}