/**
 * Claude Artifact Processor
 * Handles extraction and processing of Claude AI artifacts for calculator deployment
 */

export interface ClaudeArtifact {
  id: string;
  title: string;
  content: string;
  contentType: 'html' | 'javascript' | 'react';
  dependencies?: string[];
}

export interface ProcessedCalculator {
  title: string;
  htmlContent: string;
  hasErrors: boolean;
  errors: string[];
  warnings: string[];
  dependencies: string[];
}

export class ClaudeArtifactProcessor {
  private static readonly CLAUDE_ARTIFACT_REGEX = /https:\/\/claude\.ai\/public\/artifacts\/([a-zA-Z0-9-]+)/;
  private static readonly ALLOWED_TAGS = [
    'html', 'head', 'body', 'title', 'meta', 'style', 'script',
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'input', 'button', 'select', 'option', 'form', 'label',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'canvas', 'svg', 'path', 'circle', 'rect', 'line',
    'ul', 'ol', 'li', 'a', 'br', 'hr', 'img'
  ];

  /**
   * Check if URL is a Claude artifact
   */
  static isClaudeArtifactUrl(url: string): boolean {
    return ClaudeArtifactProcessor.CLAUDE_ARTIFACT_REGEX.test(url);
  }

  /**
   * Extract artifact ID from Claude URL
   */
  static extractArtifactId(url: string): string | null {
    const match = url.match(ClaudeArtifactProcessor.CLAUDE_ARTIFACT_REGEX);
    return match ? match[1] : null;
  }

  /**
   * Fetch artifact content from Claude (simulation - would need actual API)
   * In practice, this would make a request to Claude's API or scrape the page
   */
  static async fetchArtifactContent(url: string): Promise<ClaudeArtifact | null> {
    try {
      // For now, we'll simulate the artifact content
      // In a real implementation, you would:
      // 1. Make a request to the Claude artifact URL
      // 2. Parse the HTML to extract the artifact content
      // 3. Identify the content type and dependencies
      
      const artifactId = ClaudeArtifactProcessor.extractArtifactId(url);
      if (!artifactId) return null;

      // Simulated response - in real implementation this would fetch from Claude
      const mockArtifact: ClaudeArtifact = {
        id: artifactId,
        title: 'Investment Growth Calculator',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Investment Growth Calculator</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 {
            text-align: center;
            color: #4a5568;
            margin-bottom: 30px;
        }
        .input-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #2d3748;
        }
        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            margin-top: 20px;
            transition: transform 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
        }
        .results {
            margin-top: 30px;
            padding: 20px;
            background: #f7fafc;
            border-radius: 10px;
            border-left: 5px solid #667eea;
        }
        .result-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 18px;
        }
        .result-value {
            font-weight: bold;
            color: #667eea;
        }
        .chart-container {
            margin-top: 30px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>💰 Investment Growth Calculator</h1>
        
        <div class="input-group">
            <label for="initialAmount">Initial Investment ($)</label>
            <input type="number" id="initialAmount" value="10000" min="0" step="100">
        </div>
        
        <div class="input-group">
            <label for="monthlyContribution">Monthly Contribution ($)</label>
            <input type="number" id="monthlyContribution" value="500" min="0" step="50">
        </div>
        
        <div class="input-group">
            <label for="annualReturn">Expected Annual Return (%)</label>
            <input type="number" id="annualReturn" value="7" min="0" max="30" step="0.1">
        </div>
        
        <div class="input-group">
            <label for="investmentPeriod">Investment Period (years)</label>
            <input type="number" id="investmentPeriod" value="30" min="1" max="50" step="1">
        </div>
        
        <button onclick="calculateInvestment()">Calculate Growth</button>
        
        <div id="results" class="results" style="display: none;">
            <div class="result-item">
                <span>Total Invested:</span>
                <span id="totalInvested" class="result-value">$0</span>
            </div>
            <div class="result-item">
                <span>Total Returns:</span>
                <span id="totalReturns" class="result-value">$0</span>
            </div>
            <div class="result-item">
                <span>Final Amount:</span>
                <span id="finalAmount" class="result-value">$0</span>
            </div>
        </div>
    </div>

    <script>
        function calculateInvestment() {
            const initialAmount = parseFloat(document.getElementById('initialAmount').value) || 0;
            const monthlyContribution = parseFloat(document.getElementById('monthlyContribution').value) || 0;
            const annualReturn = parseFloat(document.getElementById('annualReturn').value) / 100 || 0;
            const years = parseInt(document.getElementById('investmentPeriod').value) || 0;
            
            const monthlyReturn = annualReturn / 12;
            const totalMonths = years * 12;
            
            // Calculate future value of initial investment
            const futureValueInitial = initialAmount * Math.pow(1 + monthlyReturn, totalMonths);
            
            // Calculate future value of monthly contributions (annuity)
            const futureValueAnnuity = monthlyContribution * 
                ((Math.pow(1 + monthlyReturn, totalMonths) - 1) / monthlyReturn);
            
            const finalAmount = futureValueInitial + futureValueAnnuity;
            const totalInvested = initialAmount + (monthlyContribution * totalMonths);
            const totalReturns = finalAmount - totalInvested;
            
            // Display results
            document.getElementById('totalInvested').textContent = formatCurrency(totalInvested);
            document.getElementById('totalReturns').textContent = formatCurrency(totalReturns);
            document.getElementById('finalAmount').textContent = formatCurrency(finalAmount);
            document.getElementById('results').style.display = 'block';
        }
        
        function formatCurrency(amount) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(amount);
        }
        
        // Calculate on page load
        calculateInvestment();
    </script>
</body>
</html>`,
        contentType: 'html',
        dependencies: []
      };

      return mockArtifact;
    } catch (error) {
      console.error('Error fetching Claude artifact:', error);
      return null;
    }
  }

  /**
   * Process and sanitize artifact content for safe deployment
   */
  static processArtifactForDeployment(artifact: ClaudeArtifact): ProcessedCalculator {
    const result: ProcessedCalculator = {
      title: artifact.title,
      htmlContent: '',
      hasErrors: false,
      errors: [],
      warnings: [],
      dependencies: artifact.dependencies || []
    };

    try {
      // Basic HTML validation and sanitization
      let content = artifact.content;

      // Check for potentially dangerous content
      const dangerousPatterns = [
        /<script[^>]*src\s*=\s*["'][^"']*["'][^>]*>/gi, // External scripts
        /eval\s*\(/gi, // eval() calls
        /document\.write/gi, // document.write calls
        /innerHTML\s*=/gi, // innerHTML assignments (potential XSS)
        /window\./gi, // Window object access
        /fetch\s*\(/gi, // Fetch calls
        /XMLHttpRequest/gi, // AJAX requests
        /websocket/gi, // WebSocket connections
      ];

      dangerousPatterns.forEach((pattern, index) => {
        if (pattern.test(content)) {
          const warnings = [
            'External script detected - may not work in isolated environment',
            'eval() function detected - potential security risk',
            'document.write() detected - not recommended',
            'innerHTML usage detected - check for XSS vulnerabilities', 
            'Window object access detected - may not work in iframe',
            'Network request detected - will not work in isolated environment',
            'Network request detected - will not work in isolated environment',
            'WebSocket detected - will not work in isolated environment'
          ];
          result.warnings.push(warnings[index]);
        }
      });

      // Remove potentially dangerous attributes
      content = content.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, ''); // Remove event handlers
      
      // Validate HTML structure
      if (!content.includes('<!DOCTYPE html>') && !content.includes('<html')) {
        content = `<!DOCTYPE html>\n<html>\n<head>\n<title>${artifact.title}</title>\n</head>\n<body>\n${content}\n</body>\n</html>`;
        result.warnings.push('Added missing HTML structure');
      }

      // Add security meta tags
      if (!content.includes('<meta') || !content.includes('Content-Security-Policy')) {
        const metaTags = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval';">
        `;
        content = content.replace('<head>', `<head>${metaTags}`);
        result.warnings.push('Added security meta tags');
      }

      result.htmlContent = content;

      // Validate that it's functional HTML
      if (content.length < 50) {
        result.hasErrors = true;
        result.errors.push('Content appears to be too short or empty');
      }

    } catch (error) {
      result.hasErrors = true;
      result.errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Generate a safe filename for the calculator
   */
  static generateSafeFilename(title: string, artifactId: string): string {
    const safeTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    return `calc-${safeTitle}-${artifactId}.html`;
  }

  /**
   * Extract dependencies from HTML content
   */
  static extractDependencies(htmlContent: string): string[] {
    const dependencies: string[] = [];
    
    // Extract CSS frameworks
    const cssLinks = htmlContent.match(/<link[^>]*href\s*=\s*["']([^"']*\.css[^"']*)["'][^>]*>/gi);
    if (cssLinks) {
      cssLinks.forEach(link => {
        const hrefMatch = link.match(/href\s*=\s*["']([^"']*)["']/);
        if (hrefMatch) {
          dependencies.push(hrefMatch[1]);
        }
      });
    }

    // Extract JavaScript libraries
    const scriptTags = htmlContent.match(/<script[^>]*src\s*=\s*["']([^"']*\.js[^"']*)["'][^>]*>/gi);
    if (scriptTags) {
      scriptTags.forEach(script => {
        const srcMatch = script.match(/src\s*=\s*["']([^"']*)["']/);
        if (srcMatch) {
          dependencies.push(srcMatch[1]);
        }
      });
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Validate HTML structure and content
   */
  static validateHtmlStructure(htmlContent: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for basic HTML structure
    if (!htmlContent.includes('<html') && !htmlContent.includes('<!DOCTYPE')) {
      issues.push('Missing HTML document structure');
    }

    // Check for potential XSS vectors
    const xssPatterns = [
      /<script[^>]*>.*?javascript:.*?<\/script>/gi,
      /on\w+\s*=\s*["'][^"']*javascript:/gi,
      /<iframe[^>]*src\s*=\s*["']javascript:/gi
    ];

    xssPatterns.forEach(pattern => {
      if (pattern.test(htmlContent)) {
        issues.push('Potential XSS vulnerability detected');
      }
    });

    // Check for missing required elements for calculators
    if (!htmlContent.includes('<input') && !htmlContent.includes('<button') && !htmlContent.includes('<select')) {
      issues.push('No interactive elements found - may not be a functional calculator');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

// Utility functions for working with Claude artifacts
export const claudeArtifactUtils = {
  isClaudeUrl: ClaudeArtifactProcessor.isClaudeArtifactUrl,
  extractId: ClaudeArtifactProcessor.extractArtifactId,
  processForDeployment: ClaudeArtifactProcessor.processArtifactForDeployment,
  generateFilename: ClaudeArtifactProcessor.generateSafeFilename,
  validateHtml: ClaudeArtifactProcessor.validateHtmlStructure
};