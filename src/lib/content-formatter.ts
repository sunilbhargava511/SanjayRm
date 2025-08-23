/**
 * Content Formatting Utilities for Debug Panel
 * Provides better readability for knowledge base content
 */

export interface ContentAnalysis {
  type: 'markdown' | 'json' | 'html' | 'url' | 'plain' | 'encoded';
  confidence: number;
  hasCodeBlocks: boolean;
  hasMarkdownHeaders: boolean;
  hasJsonStructure: boolean;
  hasHtmlTags: boolean;
  hasUrls: boolean;
  isEncoded: boolean;
  lineCount: number;
  wordCount: number;
}

export interface FormattedContent {
  original: string;
  formatted: string;
  preview: string;
  analysis: ContentAnalysis;
  shouldRenderAsMarkdown: boolean;
  shouldHighlightSyntax: boolean;
}

export interface TruncationOptions {
  maxLength: number;
  preferParagraphs: boolean;
  preserveStructure: boolean;
  addEllipsis: boolean;
  respectWordBoundaries: boolean;
}

/**
 * Analyzes content to determine its type and structure
 */
export function analyzeContent(content: string): ContentAnalysis {
  // Handle null or undefined content
  if (!content || typeof content !== 'string') {
    return {
      type: 'plain',
      confidence: 0.1,
      hasCodeBlocks: false,
      hasMarkdownHeaders: false,
      hasJsonStructure: false,
      hasHtmlTags: false,
      hasUrls: false,
      isEncoded: false,
      lineCount: 0,
      wordCount: 0
    };
  }

  // Check for binary/PDF content first
  if (content.startsWith('%PDF-') || content.includes('\0') || /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(content.substring(0, 100))) {
    return {
      type: 'encoded',
      confidence: 0.9,
      hasCodeBlocks: false,
      hasMarkdownHeaders: false,
      hasJsonStructure: false,
      hasHtmlTags: false,
      hasUrls: false,
      isEncoded: true,
      lineCount: content.split('\n').length,
      wordCount: 0
    };
  }

  const lines = content.split('\n');
  const words = content.split(/\s+/).filter(w => w.length > 0);
  
  // Check for various content patterns
  const hasMarkdownHeaders = /^#{1,6}\s/.test(content) || content.includes('\n# ') || content.includes('\n## ');
  const hasCodeBlocks = content.includes('```') || content.includes('    ') || /^\s{4,}/m.test(content);
  const hasJsonStructure = /^\s*[\[{]/.test(content.trim()) && /[\]}]\s*$/.test(content.trim());
  const hasHtmlTags = /<[^>]+>/.test(content);
  const hasUrls = /https?:\/\/[^\s]+/.test(content);
  const isEncoded = /^[A-Za-z0-9+/]+=*$/.test(content.replace(/\s/g, '')) && content.length > 50;
  
  // Determine primary content type
  let type: ContentAnalysis['type'] = 'plain';
  let confidence = 0.5;
  
  if (hasJsonStructure) {
    try {
      JSON.parse(content);
      type = 'json';
      confidence = 0.9;
    } catch {
      // Not valid JSON despite structure
    }
  } else if (hasMarkdownHeaders || hasCodeBlocks) {
    type = 'markdown';
    confidence = 0.8;
  } else if (hasHtmlTags) {
    type = 'html';
    confidence = 0.7;
  } else if (hasUrls && content.split(/\s+/).length < 10) {
    type = 'url';
    confidence = 0.8;
  } else if (isEncoded) {
    type = 'encoded';
    confidence = 0.7;
  }
  
  return {
    type,
    confidence,
    hasCodeBlocks,
    hasMarkdownHeaders,
    hasJsonStructure,
    hasHtmlTags,
    hasUrls,
    isEncoded,
    lineCount: lines.length,
    wordCount: words.length
  };
}

/**
 * Formats content based on its type for better readability
 */
export function formatContent(content: string): FormattedContent {
  const analysis = analyzeContent(content);
  let formatted = content;
  let shouldRenderAsMarkdown = false;
  let shouldHighlightSyntax = false;
  
  switch (analysis.type) {
    case 'json':
      try {
        const parsed = JSON.parse(content);
        formatted = JSON.stringify(parsed, null, 2);
        shouldHighlightSyntax = true;
      } catch {
        // Keep original if JSON parsing fails
      }
      break;
      
    case 'markdown':
      // Clean up markdown formatting
      formatted = content
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      shouldRenderAsMarkdown = true;
      break;
      
    case 'html':
      // Basic HTML formatting (just add line breaks for readability)
      formatted = content
        .replace(/></g, '>\n<')
        .replace(/\n{3,}/g, '\n\n');
      shouldHighlightSyntax = true;
      break;
      
    case 'encoded':
      // Handle different types of encoded content
      if (content.startsWith('%PDF-')) {
        formatted = `[PDF Document - ${(content.length / 1024).toFixed(1)} KB]\n\nThis appears to be a PDF file. The content shows PDF binary data which cannot be displayed as text. To view this document properly, it would need to be processed through a PDF parser.\n\nFile size: ${content.length.toLocaleString()} bytes\nDocument type: PDF`;
      } else if (content.includes('\0') || /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(content.substring(0, 100))) {
        formatted = `[Binary Content - ${(content.length / 1024).toFixed(1)} KB]\n\nThis content contains binary data that cannot be displayed as readable text. It may be:\n- A corrupted text file\n- An encoded document\n- Binary file data\n\nFile size: ${content.length.toLocaleString()} bytes`;
      } else {
        // Try to decode if it looks like base64
        try {
          if (typeof window !== 'undefined') {
            const decoded = atob(content.replace(/\s/g, ''));
            formatted = `[Base64 Decoded]\n${decoded}`;
          } else {
            formatted = `[Base64 Encoded Content - ${content.length} characters]\n\nThis content appears to be Base64 encoded. Decoding is only available in browser environment.`;
          }
        } catch {
          formatted = `[Encoded Content - ${content.length} characters]\n\nThis content appears to be encoded but the format is not recognized.`;
        }
      }
      break;
      
    case 'url':
      // Format URLs nicely
      formatted = content.replace(/(https?:\/\/[^\s]+)/g, '\n$1\n').trim();
      break;
      
    default:
      // Plain text - improve paragraph structure
      formatted = content
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
  }
  
  const preview = createPreview(formatted, {
    maxLength: 300,
    preferParagraphs: true,
    preserveStructure: true,
    addEllipsis: true,
    respectWordBoundaries: true
  });
  
  return {
    original: content,
    formatted,
    preview,
    analysis,
    shouldRenderAsMarkdown,
    shouldHighlightSyntax
  };
}

/**
 * Creates an intelligent preview of content
 */
export function createPreview(content: string, options: TruncationOptions): string {
  const { maxLength, preferParagraphs, preserveStructure, addEllipsis, respectWordBoundaries } = options;
  
  if (content.length <= maxLength) {
    return content;
  }
  
  let truncated = content;
  
  if (preserveStructure) {
    // Try to preserve markdown headers, code blocks, etc.
    const lines = content.split('\n');
    let result = '';
    let currentLength = 0;
    
    for (const line of lines) {
      if (currentLength + line.length + 1 > maxLength) {
        break;
      }
      result += line + '\n';
      currentLength += line.length + 1;
    }
    
    truncated = result.trim();
  } else if (preferParagraphs) {
    // Try to break at paragraph boundaries
    const paragraphs = content.split('\n\n');
    let result = '';
    
    for (const paragraph of paragraphs) {
      if (result.length + paragraph.length + 2 > maxLength) {
        break;
      }
      result += paragraph + '\n\n';
    }
    
    truncated = result.trim();
  } else {
    // Simple truncation
    truncated = content.substring(0, maxLength);
  }
  
  if (respectWordBoundaries && truncated.length < content.length) {
    // Don't break in the middle of a word
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) {
      truncated = truncated.substring(0, lastSpace);
    }
  }
  
  if (addEllipsis && truncated.length < content.length) {
    truncated += '...';
  }
  
  return truncated;
}

/**
 * Highlights search terms in content
 */
export function highlightSearchTerms(content: string, searchTerms: string[]): string {
  if (!searchTerms || searchTerms.length === 0) {
    return content;
  }
  
  let highlighted = content;
  
  for (const term of searchTerms) {
    if (term.trim().length < 2) continue;
    
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark class="search-highlight">$1</mark>');
  }
  
  return highlighted;
}

/**
 * Extracts search terms from a query string
 */
export function extractSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 2)
    .filter(term => !['and', 'or', 'the', 'for', 'with', 'about'].includes(term));
}

/**
 * Formats processing time in a human-readable way
 */
export function formatProcessingTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Formats file size in a human-readable way
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * Determines relevance level based on content analysis
 */
export function calculateRelevanceLevel(content: string, searchTerms: string[]): {
  level: 'high' | 'medium' | 'low';
  score: number;
  matches: Array<{ term: string; count: number }>;
} {
  const contentLower = content.toLowerCase();
  const matches: Array<{ term: string; count: number }> = [];
  let totalMatches = 0;
  
  for (const term of searchTerms) {
    const termLower = term.toLowerCase();
    const regex = new RegExp(escapeRegex(termLower), 'gi');
    const matchCount = (content.match(regex) || []).length;
    
    if (matchCount > 0) {
      matches.push({ term, count: matchCount });
      totalMatches += matchCount;
    }
  }
  
  // Calculate score based on match frequency and content length
  const score = Math.min(1, (totalMatches * 100) / content.length);
  
  let level: 'high' | 'medium' | 'low';
  if (score > 0.1) {
    level = 'high';
  } else if (score > 0.05) {
    level = 'medium';
  } else {
    level = 'low';
  }
  
  return { level, score, matches };
}

/**
 * Formats article metadata for display
 */
export function formatArticleMetadata(article: any): {
  formattedSize: string;
  formattedReadTime: string;
  formattedDate: string;
  categoryColor: string;
} {
  const formattedSize = formatFileSize(article.content?.length || 0);
  const formattedReadTime = article.readTime || 'Unknown';
  const formattedDate = article.lastUpdated 
    ? new Date(article.lastUpdated).toLocaleDateString()
    : 'Unknown';
  
  // Assign colors to categories for visual distinction
  const categoryColors: Record<string, string> = {
    'financial-planning': 'bg-blue-100 text-blue-800',
    'investment': 'bg-green-100 text-green-800',
    'budgeting': 'bg-purple-100 text-purple-800',
    'debt-management': 'bg-red-100 text-red-800',
    'insurance': 'bg-orange-100 text-orange-800',
    'retirement': 'bg-indigo-100 text-indigo-800',
    'tax': 'bg-yellow-100 text-yellow-800',
    'general': 'bg-gray-100 text-gray-800'
  };
  
  const categoryColor = categoryColors[article.category] || categoryColors.general;
  
  return {
    formattedSize,
    formattedReadTime,
    formattedDate,
    categoryColor
  };
}

/**
 * Escapes special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detects if content contains sensitive information
 */
export function detectSensitiveContent(content: string): {
  hasSensitiveData: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Check for potential sensitive patterns
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(content)) {
    warnings.push('Potential SSN detected');
  }
  
  if (/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/.test(content)) {
    warnings.push('Potential credit card number detected');
  }
  
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(content)) {
    warnings.push('Email addresses detected');
  }
  
  if (/\b\(\d{3}\)[- ]?\d{3}[- ]?\d{4}\b/.test(content)) {
    warnings.push('Phone numbers detected');
  }
  
  return {
    hasSensitiveData: warnings.length > 0,
    warnings
  };
}