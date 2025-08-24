'use client';

import React, { useState } from 'react';
import { Eye, Code, Download, AlertTriangle, CheckCircle } from 'lucide-react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  maxHeight?: string;
  showPreview?: boolean;
  onValidate?: (content: string) => { valid: boolean; errors: string[]; warnings: string[] };
}

export default function CodeEditor({
  value,
  onChange,
  placeholder = 'Paste your HTML calculator code here...',
  title = 'Calculator Code',
  maxHeight = '400px',
  showPreview = true,
  onValidate
}: CodeEditorProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const handleCodeChange = (newValue: string) => {
    onChange(newValue);
    
    // Run validation if validator provided
    if (onValidate) {
      const result = onValidate(newValue);
      setValidationResult(result);
    }
  };

  const downloadCode = () => {
    if (!value) return;
    
    const blob = new Blob([value], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calculator.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatCode = () => {
    if (!value) return;
    
    try {
      // Basic HTML formatting
      let formatted = value
        .replace(/></g, '>\n<')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Add indentation
      let indent = 0;
      const lines = formatted.split('\n').map(line => {
        const trimmedLine = line.trim();
        
        if (trimmedLine.includes('</') && !trimmedLine.includes('</'+ trimmedLine.split('</')[1].split('>')[0] + '>')) {
          indent = Math.max(0, indent - 2);
        }
        
        const formattedLine = '  '.repeat(indent / 2) + trimmedLine;
        
        if (trimmedLine.startsWith('<') && !trimmedLine.startsWith('</') && !trimmedLine.endsWith('/>')) {
          indent += 2;
        }
        
        return formattedLine;
      });
      
      handleCodeChange(lines.join('\n'));
    } catch (error) {
      console.error('Error formatting code:', error);
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={formatCode}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            disabled={!value}
          >
            <Code className="h-4 w-4" />
            Format
          </button>
          <button
            type="button"
            onClick={downloadCode}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            disabled={!value}
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      {showPreview && (
        <div className="flex mb-3 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'code'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Code className="h-4 w-4 inline mr-1" />
            Code
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            disabled={!value}
          >
            <Eye className="h-4 w-4 inline mr-1" />
            Preview
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        {activeTab === 'code' ? (
          <textarea
            value={value}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder={placeholder}
            className="w-full p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ 
              minHeight: '300px',
              maxHeight: maxHeight,
              backgroundColor: '#f8f9fa',
              lineHeight: '1.5'
            }}
            spellCheck={false}
          />
        ) : (
          <div 
            className="p-4 bg-white overflow-auto"
            style={{ 
              minHeight: '300px',
              maxHeight: maxHeight 
            }}
          >
            {value ? (
              <iframe
                srcDoc={value}
                className="w-full h-full border-0"
                style={{ minHeight: '280px' }}
                sandbox="allow-scripts allow-same-origin"
                title="Calculator Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>No code to preview</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Validation Results */}
      {validationResult && (
        <div className="mt-4 space-y-2">
          {/* Errors */}
          {validationResult.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">
                  Errors ({validationResult.errors.length})
                </span>
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                {validationResult.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {validationResult.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  Warnings ({validationResult.warnings.length})
                </span>
              </div>
              <ul className="text-sm text-yellow-700 space-y-1">
                {validationResult.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Success */}
          {validationResult.valid && validationResult.errors.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Code validation passed
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Code Stats */}
      {value && (
        <div className="mt-2 text-xs text-gray-500 flex justify-between">
          <span>Lines: {value.split('\n').length}</span>
          <span>Characters: {value.length}</span>
        </div>
      )}
    </div>
  );
}

// Helper component for syntax highlighting (basic)
export function SyntaxHighlighter({ code, language = 'html' }: { code: string; language?: string }) {
  const highlightHtml = (html: string) => {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(&lt;\/?)([\w-]+)(.*?)(&gt;)/g, 
        '<span class="text-blue-600">$1</span><span class="text-purple-600">$2</span><span class="text-green-600">$3</span><span class="text-blue-600">$4</span>')
      .replace(/([\w-]+)(=)("[^"]*")/g, 
        '<span class="text-red-600">$1</span><span class="text-gray-800">$2</span><span class="text-green-600">$3</span>');
  };

  return (
    <pre className="text-sm font-mono whitespace-pre-wrap">
      <code 
        dangerouslySetInnerHTML={{ 
          __html: language === 'html' ? highlightHtml(code) : code 
        }}
      />
    </pre>
  );
}