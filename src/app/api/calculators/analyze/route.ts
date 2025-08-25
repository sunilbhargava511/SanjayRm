import { NextRequest, NextResponse } from 'next/server';
import { CalculatorAnalyzer } from '@/lib/calculator-analyzer';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const calculatorUrl = formData.get('url') as string;

    if (!file && !calculatorUrl) {
      return NextResponse.json(
        { success: false, error: 'Either a file or calculator URL must be provided' },
        { status: 400 }
      );
    }

    let analysis;

    if (file && file.size > 0) {
      // Validate file type
      const fileName = file.name;
      const allowedExtensions = ['.tsx', '.ts', '.js', '.jsx', '.html', '.htm'];
      const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
      
      if (!allowedExtensions.includes(fileExtension)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Unsupported file type: ${fileExtension}. Supported types: ${allowedExtensions.join(', ')}` 
          },
          { status: 400 }
        );
      }

      const fileContent = await file.text();
      analysis = await CalculatorAnalyzer.analyzeCalculatorCode(fileContent, fileName);
    } else if (calculatorUrl) {
      analysis = await CalculatorAnalyzer.analyzeCalculatorUrl(calculatorUrl);
    }

    return NextResponse.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Calculator analysis error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Analysis failed' 
      },
      { status: 500 }
    );
  }
}