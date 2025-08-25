import { NextRequest, NextResponse } from 'next/server';
import { calculatorService } from '@/lib/calculator-service';
import { ClaudeArtifactProcessor, claudeArtifactUtils } from '@/lib/claude-artifact-processor';
import { CalculatorAnalyzer } from '@/lib/calculator-analyzer';
import { initializeDatabase } from '@/lib/database';

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const artifactUrl = formData.get('artifactUrl') as string;
    let name = formData.get('name') as string;
    let description = formData.get('description') as string;
    const autoAnalyze = formData.get('autoAnalyze') as string;

    let codeContent = '';
    let fileName = '';
    let processedArtifactUrl = '';

    // Auto-analyze calculator if requested (and name/description are missing)
    if (autoAnalyze === 'true' && (!name || !description)) {
      try {
        let analysis;
        
        if (file && file.size > 0) {
          const fileContent = await file.text();
          analysis = await CalculatorAnalyzer.analyzeCalculatorCode(fileContent, file.name);
        } else if (artifactUrl) {
          analysis = await CalculatorAnalyzer.analyzeClaudeArtifact(artifactUrl);
        }
        
        if (analysis) {
          // Use analyzed values if not provided by user
          if (!name) name = analysis.name;
          if (!description) description = analysis.description;
          
          console.log(`Auto-analysis completed with confidence: ${analysis.confidence}`);
        }
      } catch (error) {
        console.error('Auto-analysis failed:', error);
        // Continue without auto-analysis
      }
    }

    // Validate required fields after potential auto-analysis
    if (!name || !description) {
      return NextResponse.json(
        { success: false, error: 'Name and description are required. Enable auto-analysis or provide them manually.' },
        { status: 400 }
      );
    }

    // Handle file upload
    if (file && file.size > 0) {
      const fileContent = await file.text();
      fileName = file.name;
      
      // Validate file type
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

      // Process different file types
      if (fileExtension === '.tsx' || fileExtension === '.ts' || fileExtension === '.jsx' || fileExtension === '.js') {
        // For React components, wrap in HTML
        codeContent = wrapReactComponentInHTML(fileContent, fileName);
      } else {
        // For HTML files, use as-is
        codeContent = fileContent;
      }
    }
    // Handle Claude artifact URL
    else if (artifactUrl) {
      if (!claudeArtifactUtils.isClaudeUrl(artifactUrl)) {
        return NextResponse.json(
          { success: false, error: 'Invalid Claude artifact URL format' },
          { status: 400 }
        );
      }

      try {
        const artifact = await ClaudeArtifactProcessor.fetchArtifactContent(artifactUrl);
        if (!artifact) {
          return NextResponse.json(
            { success: false, error: 'Could not fetch artifact content' },
            { status: 404 }
          );
        }

        const processed = ClaudeArtifactProcessor.processArtifactForDeployment(artifact);
        codeContent = processed.htmlContent;
        fileName = ClaudeArtifactProcessor.generateSafeFilename(artifact.title, artifact.id);
        processedArtifactUrl = artifactUrl;
      } catch (error) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Failed to process Claude artifact: ${error instanceof Error ? error.message : 'Unknown error'}` 
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Either a file or Claude artifact URL must be provided' },
        { status: 400 }
      );
    }

    // Create calculator
    const calculator = await calculatorService.createCalculator({
      name,
      description,
      calculatorType: 'code',
      codeContent,
      fileName,
      artifactUrl: processedArtifactUrl || undefined,
      isPublished: true
    });

    return NextResponse.json({
      success: true,
      calculator,
      message: 'Calculator uploaded and created successfully'
    });

  } catch (error) {
    console.error('Calculator upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

function wrapReactComponentInHTML(reactCode: string, fileName: string): string {
  // Extract component name from filename
  const componentName = fileName.replace(/\.(tsx|ts|jsx|js)$/, '').replace(/[^a-zA-Z0-9]/g, '');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${componentName} Calculator</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        #root {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div id="root"></div>
    
    <script type="text/babel">
        ${reactCode}
        
        // Try to find and render the main component
        const componentNames = ['${componentName}', 'App', 'Calculator', 'default'];
        let ComponentToRender = null;
        
        for (const name of componentNames) {
            if (typeof window[name] !== 'undefined') {
                ComponentToRender = window[name];
                break;
            }
        }
        
        if (ComponentToRender) {
            ReactDOM.render(React.createElement(ComponentToRender), document.getElementById('root'));
        } else {
            document.getElementById('root').innerHTML = '<div><h1>Calculator Loaded</h1><p>Component could not be automatically rendered. Please check the console for errors.</p></div>';
        }
    </script>
</body>
</html>`;
}