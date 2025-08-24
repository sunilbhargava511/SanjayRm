/**
 * Security Sanitization for User-Uploaded Calculator Code
 * Provides comprehensive protection against XSS, code injection, and malicious content
 */

export interface SanitizationResult {
  sanitizedContent: string;
  isModified: boolean;
  removedElements: string[];
  securityWarnings: string[];
  blocked: boolean;
  blockReason?: string;
}

export interface SanitizationOptions {
  allowExternalScripts: boolean;
  allowInlineEventHandlers: boolean;
  allowDangerousFunctions: boolean;
  allowNetworkRequests: boolean;
  strictMode: boolean;
}

export class SecuritySanitizer {
  private static readonly DEFAULT_OPTIONS: SanitizationOptions = {
    allowExternalScripts: false,
    allowInlineEventHandlers: false,
    allowDangerousFunctions: false,
    allowNetworkRequests: false,
    strictMode: true
  };

  // Dangerous HTML tags that should be removed
  private static readonly DANGEROUS_TAGS = [
    'script', 'iframe', 'embed', 'object', 'applet', 'form', 
    'frame', 'frameset', 'base', 'meta', 'link'
  ];

  // Allowed HTML tags for calculators
  private static readonly ALLOWED_TAGS = [
    'html', 'head', 'body', 'title', 'style',
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'input', 'button', 'select', 'option', 'textarea', 'label',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
    'canvas', 'svg', 'path', 'circle', 'rect', 'line', 'polygon',
    'ul', 'ol', 'li', 'a', 'br', 'hr', 'img',
    'strong', 'em', 'b', 'i', 'u', 'small', 'sup', 'sub'
  ];

  // Dangerous JavaScript patterns
  private static readonly DANGEROUS_JS_PATTERNS = [
    /eval\s*\(/gi,                           // eval() function
    /Function\s*\(/gi,                       // Function constructor
    /setTimeout\s*\(\s*["'].*?["']/gi,      // setTimeout with string
    /setInterval\s*\(\s*["'].*?["']/gi,     // setInterval with string
    /document\.write/gi,                     // document.write
    /document\.writeln/gi,                   // document.writeln
    /innerHTML\s*=/gi,                       // innerHTML assignment
    /outerHTML\s*=/gi,                       // outerHTML assignment
    /\.execScript/gi,                        // execScript
    /javascript:/gi,                         // javascript: protocol
    /vbscript:/gi,                          // vbscript: protocol
    /data:/gi,                              // data: protocol
    /window\.open/gi,                       // window.open
    /location\s*=/gi,                       // location redirect
    /window\.location/gi,                   // window.location
    /fetch\s*\(/gi,                         // fetch API
    /XMLHttpRequest/gi,                     // XMLHttpRequest
    /WebSocket/gi,                          // WebSocket
    /EventSource/gi,                        // Server-Sent Events
    /import\s*\(/gi,                        // Dynamic imports
    /require\s*\(/gi,                       // CommonJS require
    /process\./gi,                          // Node.js process
    /global\./gi,                           // Global object
    /window\.__/gi,                         // Private window properties
    /document\.__/gi,                       // Private document properties
  ];

  // Event handlers that should be removed
  private static readonly EVENT_HANDLER_ATTRIBUTES = [
    'onabort', 'onactivate', 'onafterprint', 'onafterscriptexecute', 'onafterupdate',
    'onbeforeactivate', 'onbeforecopy', 'onbeforecut', 'onbeforedeactivate',
    'onbeforeeditfocus', 'onbeforepaste', 'onbeforeprint', 'onbeforescriptexecute',
    'onbeforeunload', 'onbeforeupdate', 'onblur', 'onbounce', 'oncellchange',
    'onchange', 'onclick', 'oncontextmenu', 'oncontrolselect', 'oncopy',
    'oncut', 'ondataavailable', 'ondatasetchanged', 'ondatasetcomplete',
    'ondblclick', 'ondeactivate', 'ondrag', 'ondragend', 'ondragenter',
    'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'onerror',
    'onerrorupdate', 'onfilterchange', 'onfinish', 'onfocus', 'onfocusin',
    'onfocusout', 'onhelp', 'onkeydown', 'onkeypress', 'onkeyup', 'onlayoutcomplete',
    'onload', 'onlosecapture', 'onmousedown', 'onmouseenter', 'onmouseleave',
    'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onmousewheel',
    'onmove', 'onmoveend', 'onmovestart', 'onpaste', 'onpropertychange',
    'onreadystatechange', 'onreset', 'onresize', 'onresizeend', 'onresizestart',
    'onrowenter', 'onrowexit', 'onrowsdelete', 'onrowsinserted', 'onscroll',
    'onselect', 'onselectionchange', 'onselectstart', 'onstart', 'onstop',
    'onsubmit', 'onunload'
  ];

  // Dangerous CSS patterns
  private static readonly DANGEROUS_CSS_PATTERNS = [
    /expression\s*\(/gi,                    // IE CSS expressions
    /javascript\s*:/gi,                     // JavaScript in CSS
    /vbscript\s*:/gi,                      // VBScript in CSS
    /data\s*:/gi,                          // Data URLs in CSS
    /@import/gi,                           // CSS imports
    /behavior\s*:/gi,                      // IE behaviors
    /binding\s*:/gi,                       // Mozilla bindings
    /-moz-binding/gi,                      // Mozilla binding
    /url\s*\(\s*["']?\s*javascript:/gi,   // JavaScript URLs
    /url\s*\(\s*["']?\s*data:/gi,         // Data URLs
  ];

  /**
   * Main sanitization method
   */
  static sanitize(
    htmlContent: string, 
    options: Partial<SanitizationOptions> = {}
  ): SanitizationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const result: SanitizationResult = {
      sanitizedContent: htmlContent,
      isModified: false,
      removedElements: [],
      securityWarnings: [],
      blocked: false
    };

    try {
      // Initial security check - block completely malicious content
      const blockCheck = this.performBlockCheck(htmlContent);
      if (blockCheck.shouldBlock) {
        return {
          ...result,
          blocked: true,
          blockReason: blockCheck.reason,
          sanitizedContent: ''
        };
      }

      // Step 1: Remove dangerous tags
      result.sanitizedContent = this.removeDangerousTags(
        result.sanitizedContent, 
        result, 
        opts
      );

      // Step 2: Remove event handlers
      if (!opts.allowInlineEventHandlers) {
        result.sanitizedContent = this.removeEventHandlers(
          result.sanitizedContent, 
          result
        );
      }

      // Step 3: Sanitize JavaScript content
      result.sanitizedContent = this.sanitizeJavaScript(
        result.sanitizedContent, 
        result, 
        opts
      );

      // Step 4: Sanitize CSS content
      result.sanitizedContent = this.sanitizeCSS(
        result.sanitizedContent, 
        result
      );

      // Step 5: Remove dangerous attributes
      result.sanitizedContent = this.removeDangerousAttributes(
        result.sanitizedContent, 
        result
      );

      // Step 6: Add security headers and CSP
      result.sanitizedContent = this.addSecurityHeaders(
        result.sanitizedContent
      );

      // Final validation
      this.performFinalValidation(result.sanitizedContent, result);

    } catch (error) {
      result.blocked = true;
      result.blockReason = `Sanitization error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.sanitizedContent = '';
    }

    return result;
  }

  /**
   * Perform initial block check for completely malicious content
   */
  private static performBlockCheck(content: string): { shouldBlock: boolean; reason?: string } {
    // Check for obvious malware patterns
    const malwarePatterns = [
      /<script[\s\S]*?crypto[\s\S]*?<\/script>/gi,    // Crypto mining
      /<script[\s\S]*?bitcoin[\s\S]*?<\/script>/gi,   // Bitcoin mining
      /keylogger/gi,                                   // Keyloggers
      /password[\s\S]*?steal/gi,                       // Password stealing
      /credit[\s\S]*?card[\s\S]*?steal/gi,            // Credit card stealing
      /<script[\s\S]*?\.onbeforeunload/gi,            // Page hijacking
      /document\.cookie[\s\S]*?=[\s\S]*?;/gi,         // Cookie manipulation
      /localStorage[\s\S]*?setItem/gi,                 // LocalStorage manipulation
    ];

    for (const pattern of malwarePatterns) {
      if (pattern.test(content)) {
        return { 
          shouldBlock: true, 
          reason: 'Content contains patterns associated with malicious behavior' 
        };
      }
    }

    // Check for excessive script content (potential obfuscation)
    const scriptMatches = content.match(/<script[\s\S]*?<\/script>/gi);
    if (scriptMatches) {
      const totalScriptLength = scriptMatches.join('').length;
      const contentLength = content.length;
      
      if (totalScriptLength > contentLength * 0.8) {
        return { 
          shouldBlock: true, 
          reason: 'Content is predominantly JavaScript code, which may indicate obfuscation' 
        };
      }
    }

    return { shouldBlock: false };
  }

  /**
   * Remove dangerous HTML tags
   */
  private static removeDangerousTags(
    content: string, 
    result: SanitizationResult, 
    options: SanitizationOptions
  ): string {
    let sanitized = content;

    this.DANGEROUS_TAGS.forEach(tag => {
      const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
      const matches = content.match(regex);
      
      if (matches) {
        matches.forEach(match => {
          if (tag === 'script' && options.allowExternalScripts) {
            // Check if it's an external script that should be allowed
            if (!/src\s*=/.test(match)) {
              sanitized = sanitized.replace(match, '');
              result.removedElements.push(`<${tag}> (inline)`);
              result.isModified = true;
            }
          } else {
            sanitized = sanitized.replace(match, '');
            result.removedElements.push(`<${tag}>`);
            result.isModified = true;
          }
        });
      }
    });

    return sanitized;
  }

  /**
   * Remove event handler attributes
   */
  private static removeEventHandlers(content: string, result: SanitizationResult): string {
    let sanitized = content;

    this.EVENT_HANDLER_ATTRIBUTES.forEach(handler => {
      const regex = new RegExp(`\\s${handler}\\s*=\\s*["'][^"']*["']`, 'gi');
      const matches = content.match(regex);
      
      if (matches) {
        matches.forEach(match => {
          sanitized = sanitized.replace(match, '');
          result.removedElements.push(`${handler} attribute`);
          result.isModified = true;
        });
      }
    });

    return sanitized;
  }

  /**
   * Sanitize JavaScript content
   */
  private static sanitizeJavaScript(
    content: string, 
    result: SanitizationResult, 
    options: SanitizationOptions
  ): string {
    let sanitized = content;

    // Find all script tags first
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = scriptRegex.exec(content)) !== null) {
      const scriptContent = match[1];
      let cleanScript = scriptContent;
      let scriptModified = false;

      // Check each dangerous pattern
      this.DANGEROUS_JS_PATTERNS.forEach(pattern => {
        if (pattern.test(scriptContent)) {
          if (!options.allowDangerousFunctions) {
            cleanScript = cleanScript.replace(pattern, '/* REMOVED_FOR_SECURITY */');
            scriptModified = true;
            result.securityWarnings.push(`Removed dangerous JavaScript pattern: ${pattern.source}`);
          }
        }
      });

      if (scriptModified) {
        const newScriptTag = match[0].replace(scriptContent, cleanScript);
        sanitized = sanitized.replace(match[0], newScriptTag);
        result.isModified = true;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize CSS content
   */
  private static sanitizeCSS(content: string, result: SanitizationResult): string {
    let sanitized = content;

    // Find all style tags
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match;

    while ((match = styleRegex.exec(content)) !== null) {
      const styleContent = match[1];
      let cleanStyle = styleContent;
      let styleModified = false;

      // Check each dangerous CSS pattern
      this.DANGEROUS_CSS_PATTERNS.forEach(pattern => {
        if (pattern.test(styleContent)) {
          cleanStyle = cleanStyle.replace(pattern, '/* REMOVED_FOR_SECURITY */');
          styleModified = true;
          result.securityWarnings.push(`Removed dangerous CSS pattern: ${pattern.source}`);
        }
      });

      if (styleModified) {
        const newStyleTag = match[0].replace(styleContent, cleanStyle);
        sanitized = sanitized.replace(match[0], newStyleTag);
        result.isModified = true;
      }
    }

    // Also check style attributes
    const inlineStyleRegex = /style\s*=\s*["']([^"']*?)["']/gi;
    while ((match = inlineStyleRegex.exec(content)) !== null) {
      const styleValue = match[1];
      let cleanStyleValue = styleValue;
      let inlineModified = false;

      this.DANGEROUS_CSS_PATTERNS.forEach(pattern => {
        if (pattern.test(styleValue)) {
          cleanStyleValue = cleanStyleValue.replace(pattern, '/* REMOVED */');
          inlineModified = true;
        }
      });

      if (inlineModified) {
        const newStyleAttr = match[0].replace(styleValue, cleanStyleValue);
        sanitized = sanitized.replace(match[0], newStyleAttr);
        result.isModified = true;
      }
    }

    return sanitized;
  }

  /**
   * Remove other dangerous attributes
   */
  private static removeDangerousAttributes(content: string, result: SanitizationResult): string {
    let sanitized = content;

    // Remove src attributes pointing to javascript: or data: URLs
    const dangerousUrlRegex = /(src|href)\s*=\s*["']?(javascript:|data:|vbscript:)[^"'\s>]*/gi;
    const matches = content.match(dangerousUrlRegex);
    
    if (matches) {
      matches.forEach(match => {
        sanitized = sanitized.replace(match, '');
        result.removedElements.push(`Dangerous URL attribute: ${match}`);
        result.isModified = true;
      });
    }

    return sanitized;
  }

  /**
   * Add security headers and CSP
   */
  private static addSecurityHeaders(content: string): string {
    // If no head tag exists, add basic structure
    if (!content.includes('<head>')) {
      content = content.replace('<html>', '<html>\n<head>\n</head>');
    }

    const securityHeaders = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'none'; frame-src 'none'; object-src 'none';">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta http-equiv="X-Frame-Options" content="DENY">
    <meta http-equiv="X-XSS-Protection" content="1; mode=block">
    `;

    return content.replace('<head>', `<head>${securityHeaders}`);
  }

  /**
   * Perform final validation
   */
  private static performFinalValidation(content: string, result: SanitizationResult): void {
    // Check for any remaining dangerous patterns
    const finalCheck = [
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /eval\s*\(/gi,
      /Function\s*\(/gi
    ];

    finalCheck.forEach(pattern => {
      if (pattern.test(content)) {
        result.securityWarnings.push(`Warning: Potentially dangerous pattern still present: ${pattern.source}`);
      }
    });

    // Validate HTML structure
    if (!content.includes('<html') && !content.includes('<!DOCTYPE')) {
      result.securityWarnings.push('Warning: Content lacks proper HTML structure');
    }
  }

  /**
   * Quick security check method for validation only
   */
  static quickSecurityCheck(content: string): {
    isSafe: boolean;
    risks: string[];
    recommendations: string[];
  } {
    const risks: string[] = [];
    const recommendations: string[] = [];

    // Check for dangerous patterns
    this.DANGEROUS_JS_PATTERNS.forEach(pattern => {
      if (pattern.test(content)) {
        risks.push(`Dangerous JavaScript pattern detected: ${pattern.source}`);
      }
    });

    this.DANGEROUS_CSS_PATTERNS.forEach(pattern => {
      if (pattern.test(content)) {
        risks.push(`Dangerous CSS pattern detected: ${pattern.source}`);
      }
    });

    // Check for event handlers
    this.EVENT_HANDLER_ATTRIBUTES.forEach(handler => {
      if (new RegExp(`\\b${handler}\\s*=`, 'i').test(content)) {
        risks.push(`Event handler detected: ${handler}`);
      }
    });

    // Provide recommendations
    if (risks.length > 0) {
      recommendations.push('Consider sanitizing the content before deployment');
      recommendations.push('Review and remove unnecessary JavaScript functionality');
      recommendations.push('Use Content Security Policy (CSP) headers');
    }

    return {
      isSafe: risks.length === 0,
      risks,
      recommendations
    };
  }
}

// Utility functions
export const securityUtils = {
  sanitize: SecuritySanitizer.sanitize,
  quickCheck: SecuritySanitizer.quickSecurityCheck,
  
  // Helper to create secure iframe sandbox attributes
  getSecureIframeAttrs: () => ({
    sandbox: "allow-scripts allow-same-origin allow-forms",
    referrerPolicy: "no-referrer" as const,
    loading: "lazy" as const
  }),
  
  // Generate CSP directive for calculator content
  generateCSP: (allowNetworking: boolean = false) => {
    const base = "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; object-src 'none'; frame-src 'none';";
    return allowNetworking 
      ? base.replace("connect-src 'none'", "connect-src 'self' https:")
      : base + " connect-src 'none';";
  }
};