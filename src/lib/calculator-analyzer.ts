import { getClaudeService } from './claude';
import { ClaudeArtifactProcessor } from './claude-artifact-processor';

export interface CalculatorAnalysis {
  name: string;
  description: string;
  type: string;
  confidence: 'high' | 'medium' | 'low';
}

export class CalculatorAnalyzer {
  private static readonly ANALYSIS_PROMPT = `You are an expert at analyzing calculator code and extracting meaningful information. 

Analyze the provided calculator code and return ONLY a JSON object with this exact format:
{
  "name": "Calculator Name",
  "description": "Brief description of what this calculator does (1-2 sentences)",
  "type": "Type of calculator (e.g., financial, mathematical, conversion, etc.)",
  "confidence": "high|medium|low"
}

Guidelines:
- Name should be clear and descriptive (e.g., "Compound Interest Calculator", "Loan Payment Calculator")
- Description should explain what the calculator does and what it's useful for
- Type should categorize the calculator broadly
- Confidence should reflect how clear the calculator's purpose is from the code
- Return ONLY valid JSON, no other text or explanation`;

  static async analyzeCalculatorCode(codeContent: string, fileName?: string): Promise<CalculatorAnalysis> {
    try {
      const claude = getClaudeService();
      
      // Prepare the analysis prompt with code
      const analysisText = `${this.ANALYSIS_PROMPT}

File name: ${fileName || 'unknown'}

Code to analyze:
${codeContent.substring(0, 8000)}`; // Limit code length for token efficiency

      const response = await claude.sendMessage([
        { role: 'user', content: analysisText }
      ]);
      
      // Parse the JSON response
      const cleanResponse = response.trim();
      let jsonMatch = cleanResponse;
      
      // Extract JSON if it's wrapped in code blocks
      const jsonBlockMatch = cleanResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonBlockMatch) {
        jsonMatch = jsonBlockMatch[1];
      }
      
      const analysis = JSON.parse(jsonMatch) as CalculatorAnalysis;
      
      // Validate the response structure
      if (!analysis.name || !analysis.description || !analysis.type || !analysis.confidence) {
        throw new Error('Invalid analysis response structure');
      }
      
      return analysis;
      
    } catch (error) {
      console.error('Calculator analysis failed:', error);
      
      // Fallback to basic analysis
      return this.generateFallbackAnalysis(codeContent, fileName);
    }
  }

  static async analyzeClaudeArtifact(artifactUrl: string): Promise<CalculatorAnalysis> {
    try {
      const artifact = await ClaudeArtifactProcessor.fetchArtifactContent(artifactUrl);
      if (!artifact) {
        throw new Error('Could not fetch artifact content');
      }

      // Use artifact title and content for analysis
      const analysis = await this.analyzeCalculatorCode(artifact.content, artifact.title);
      
      // If the artifact has a good title, use it as a fallback for the name
      if (artifact.title && analysis.confidence === 'low') {
        analysis.name = this.cleanArtifactTitle(artifact.title);
        analysis.confidence = 'medium';
      }
      
      return analysis;
      
    } catch (error) {
      console.error('Claude artifact analysis failed:', error);
      
      // Fallback analysis for artifacts
      return {
        name: 'Claude Artifact Calculator',
        description: 'A calculator imported from a Claude artifact.',
        type: 'general',
        confidence: 'low'
      };
    }
  }

  private static generateFallbackAnalysis(codeContent: string, fileName?: string): CalculatorAnalysis {
    const name = this.extractNameFromCode(codeContent, fileName);
    const description = this.extractDescriptionFromCode(codeContent, name);
    const type = this.inferTypeFromCode(codeContent, name);
    
    return {
      name,
      description,
      type,
      confidence: 'low'
    };
  }

  private static extractNameFromCode(codeContent: string, fileName?: string): string {
    // Try to extract name from common patterns
    const patterns = [
      /title["\s]*[:=]["\s]*([^"<>\n]+)/i,
      /<title[^>]*>([^<]+)<\/title>/i,
      /calculator["\s]*[:=]["\s]*([^"<>\n]+)/i,
      /<h1[^>]*>([^<]+)<\/h1>/i,
      /<h2[^>]*>([^<]+)<\/h2>/i,
      /class\s+(\w*Calculator\w*)/i,
      /function\s+(\w*[Cc]alculator\w*)/i,
    ];

    for (const pattern of patterns) {
      const match = codeContent.match(pattern);
      if (match && match[1].trim().length > 2) {
        return this.cleanExtractedName(match[1].trim());
      }
    }

    // Fall back to filename-based name
    if (fileName) {
      const baseName = fileName.replace(/\.(tsx|ts|jsx|js|html|htm)$/i, '');
      return this.cleanFileName(baseName);
    }

    return 'Financial Calculator';
  }

  private static extractDescriptionFromCode(codeContent: string, calculatorName: string): string {
    // Try to extract description from common patterns
    const patterns = [
      /description["\s]*[:=]["\s]*([^"<>\n]+)/i,
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
      /<p[^>]*>([^<]{50,200})<\/p>/i, // Look for substantial paragraph text
    ];

    for (const pattern of patterns) {
      const match = codeContent.match(pattern);
      if (match && match[1].trim().length > 20) {
        return match[1].trim();
      }
    }

    // Generate basic description based on detected calculator type
    const lowerName = calculatorName.toLowerCase();
    
    if (lowerName.includes('interest') || lowerName.includes('compound')) {
      return 'Calculate compound interest and investment growth over time.';
    } else if (lowerName.includes('loan') || lowerName.includes('mortgage')) {
      return 'Calculate loan payments, interest, and amortization schedules.';
    } else if (lowerName.includes('investment') || lowerName.includes('return')) {
      return 'Analyze investment returns and portfolio performance.';
    } else if (lowerName.includes('tax')) {
      return 'Calculate taxes and tax-related financial scenarios.';
    } else if (lowerName.includes('budget') || lowerName.includes('expense')) {
      return 'Track and calculate budget allocations and expenses.';
    } else if (lowerName.includes('retirement')) {
      return 'Plan for retirement savings and income needs.';
    } else {
      return `A financial calculator for ${calculatorName.toLowerCase().replace(/calculator/i, '').trim()} calculations.`;
    }
  }

  private static inferTypeFromCode(codeContent: string, calculatorName: string): string {
    const lowerContent = codeContent.toLowerCase();
    const lowerName = calculatorName.toLowerCase();

    // Financial calculator types
    if (lowerContent.includes('compound') || lowerContent.includes('interest rate') || lowerName.includes('interest')) {
      return 'interest';
    } else if (lowerContent.includes('loan') || lowerContent.includes('mortgage') || lowerContent.includes('payment')) {
      return 'loan';
    } else if (lowerContent.includes('investment') || lowerContent.includes('portfolio') || lowerContent.includes('return')) {
      return 'investment';
    } else if (lowerContent.includes('tax') || lowerContent.includes('deduction')) {
      return 'tax';
    } else if (lowerContent.includes('budget') || lowerContent.includes('expense') || lowerContent.includes('income')) {
      return 'budget';
    } else if (lowerContent.includes('retirement') || lowerContent.includes('pension')) {
      return 'retirement';
    } else if (lowerContent.includes('insurance') || lowerContent.includes('premium')) {
      return 'insurance';
    } else if (lowerContent.includes('currency') || lowerContent.includes('exchange')) {
      return 'conversion';
    } else {
      return 'financial';
    }
  }

  private static cleanExtractedName(name: string): string {
    // Clean up extracted names
    return name
      .replace(/[<>]/g, '') // Remove HTML brackets
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^[^a-zA-Z0-9]+/, '') // Remove leading non-alphanumeric
      .replace(/[^a-zA-Z0-9]+$/, '') // Remove trailing non-alphanumeric
      .trim();
  }

  private static cleanFileName(fileName: string): string {
    return fileName
      .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters
      .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
      .trim();
  }

  private static cleanArtifactTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .replace(/^[^a-zA-Z0-9]+/, '')
      .replace(/[^a-zA-Z0-9\s]+$/, '')
      .trim()
      || 'Claude Artifact Calculator';
  }

  // Helper method for client-side use
  static async analyzeFromFormData(formData: FormData): Promise<CalculatorAnalysis> {
    const file = formData.get('file') as File;
    const artifactUrl = formData.get('artifactUrl') as string;

    if (file && file.size > 0) {
      const fileContent = await file.text();
      return this.analyzeCalculatorCode(fileContent, file.name);
    } else if (artifactUrl) {
      return this.analyzeClaudeArtifact(artifactUrl);
    } else {
      throw new Error('No file or artifact URL provided for analysis');
    }
  }
}