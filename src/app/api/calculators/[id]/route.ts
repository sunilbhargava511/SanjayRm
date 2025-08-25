import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { calculators } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const calculator = await db
      .select()
      .from(calculators)
      .where(eq(calculators.id, resolvedParams.id))
      .limit(1);

    if (!calculator || calculator.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Calculator not found' },
        { status: 404 }
      );
    }

    // Transform database result to match Calculator type
    const calculatorData = {
      ...calculator[0],
      active: Boolean(calculator[0].active),
      isPublished: Boolean(calculator[0].isPublished),
      createdAt: calculator[0].createdAt,
      updatedAt: calculator[0].updatedAt
    };

    return NextResponse.json({
      success: true,
      calculator: calculatorData
    });

  } catch (error) {
    console.error('Error fetching calculator:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch calculator' 
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    const { name, url, description, calculatorType, codeContent, fileName, orderIndex, active, isPublished } = body;

    // Validate required fields
    if (!name || !description) {
      return NextResponse.json(
        { success: false, error: 'Name and description are required' },
        { status: 400 }
      );
    }

    // Validate calculator type specific requirements
    if (calculatorType === 'url' && !url) {
      return NextResponse.json(
        { success: false, error: 'URL is required for URL-based calculators' },
        { status: 400 }
      );
    }

    if (calculatorType === 'code' && !codeContent) {
      return NextResponse.json(
        { success: false, error: 'Code content is required for code-based calculators' },
        { status: 400 }
      );
    }

    // Check if calculator exists
    const existingCalculator = await db
      .select()
      .from(calculators)
      .where(eq(calculators.id, resolvedParams.id))
      .limit(1);

    if (!existingCalculator || existingCalculator.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Calculator not found' },
        { status: 404 }
      );
    }

    // Update calculator
    const updateData: any = {
      name,
      description,
      calculatorType: calculatorType || 'url',
      orderIndex: orderIndex || 0,
      active: active !== undefined ? (active ? 1 : 0) : 1,
      isPublished: isPublished !== undefined ? (isPublished ? 1 : 0) : 1,
      updatedAt: new Date().toISOString()
    };

    // Add type-specific fields
    if (calculatorType === 'url') {
      updateData.url = url;
      updateData.codeContent = null;
      updateData.fileName = null;
    } else if (calculatorType === 'code') {
      updateData.codeContent = codeContent;
      updateData.url = null;
      updateData.fileName = fileName || null;
    }


    const updatedCalculator = await db
      .update(calculators)
      .set(updateData)
      .where(eq(calculators.id, resolvedParams.id))
      .returning();

    return NextResponse.json({
      success: true,
      calculator: updatedCalculator[0]
    });

  } catch (error) {
    console.error('Error updating calculator:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update calculator' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    // Check if calculator exists
    const existingCalculator = await db
      .select()
      .from(calculators)
      .where(eq(calculators.id, resolvedParams.id))
      .limit(1);

    if (!existingCalculator || existingCalculator.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Calculator not found' },
        { status: 404 }
      );
    }

    // Delete calculator
    await db
      .delete(calculators)
      .where(eq(calculators.id, resolvedParams.id));

    return NextResponse.json({
      success: true,
      message: 'Calculator deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting calculator:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete calculator' 
      },
      { status: 500 }
    );
  }
}