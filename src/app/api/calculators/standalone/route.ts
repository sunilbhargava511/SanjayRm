import { NextRequest, NextResponse } from 'next/server';
import { calculatorService } from '@/lib/calculator-service';
import { reactToHtmlConverter } from '@/lib/react-to-html-converter';
import fs from 'fs';
import path from 'path';

/**
 * API to manage standalone calculator pages
 */
export async function POST(request: NextRequest) {
  try {
    const { calculatorId, regenerate } = await request.json();
    
    if (!calculatorId) {
      return NextResponse.json(
        { success: false, error: 'Calculator ID is required' },
        { status: 400 }
      );
    }

    // Get calculator from database
    const calculator = await calculatorService.getCalculator(calculatorId);
    if (!calculator) {
      return NextResponse.json(
        { success: false, error: 'Calculator not found' },
        { status: 404 }
      );
    }

    // Check if it's a React component that can be converted
    const isReactComponent = calculator.fileName && 
      /\.(tsx|ts|jsx|js)$/.test(calculator.fileName);

    if (!isReactComponent) {
      return NextResponse.json(
        { success: false, error: 'Calculator is not a React component' },
        { status: 400 }
      );
    }

    // Check if standalone file already exists
    const publicPath = path.join(process.cwd(), 'public', 'calculators', `${calculatorId}.html`);
    const standaloneUrl = `/calculators/${calculatorId}.html`;
    
    if (fs.existsSync(publicPath) && !regenerate) {
      return NextResponse.json({
        success: true,
        exists: true,
        standaloneUrl,
        message: 'Standalone calculator already exists'
      });
    }

    // Generate standalone HTML from stored code
    if (!calculator.codeContent) {
      return NextResponse.json(
        { success: false, error: 'Calculator has no code content to convert' },
        { status: 400 }
      );
    }

    // Extract original React code if it was wrapped
    let originalCode = calculator.codeContent;
    
    // If it's wrapped HTML, try to extract the React code
    const babelScriptMatch = originalCode.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
    if (babelScriptMatch) {
      // This is wrapped HTML, extract the React code
      const wrappedCode = babelScriptMatch[1];
      // Remove the wrapper logic and get back to original React code
      const cleanedCode = wrappedCode
        .replace(/\/\/ Try to find and render.*$/gm, '')
        .replace(/const componentNames = .*$/gm, '')
        .replace(/let ComponentToRender = .*$/gm, '')
        .replace(/for \(const name of componentNames\) \{[\s\S]*?\}/gm, '')
        .replace(/if \(ComponentToRender\) \{[\s\S]*?\}/gm, '')
        .replace(/ReactDOM\.render.*$/gm, '')
        .trim();
      
      originalCode = cleanedCode;
    }

    const standaloneHtml = await reactToHtmlConverter.convertToStandaloneHtml(
      originalCode,
      calculator.fileName || 'calculator.tsx',
      calculator.name,
      calculator.description
    );

    // Save to public directory
    await reactToHtmlConverter.saveStandaloneHtml(standaloneHtml, calculatorId);

    return NextResponse.json({
      success: true,
      standaloneUrl,
      message: 'Standalone calculator generated successfully'
    });

  } catch (error) {
    console.error('Standalone calculator generation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate standalone calculator'
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Check if standalone calculator exists
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const calculatorId = searchParams.get('id');

    if (!calculatorId) {
      return NextResponse.json(
        { success: false, error: 'Calculator ID is required' },
        { status: 400 }
      );
    }

    const publicPath = path.join(process.cwd(), 'public', 'calculators', `${calculatorId}.html`);
    const exists = fs.existsSync(publicPath);

    return NextResponse.json({
      success: true,
      exists,
      standaloneUrl: exists ? `/calculators/${calculatorId}.html` : null
    });

  } catch (error) {
    console.error('Standalone calculator check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check standalone calculator'
      },
      { status: 500 }
    );
  }
}