'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  searchTerms?: string[];
  className?: string;
  maxHeight?: string;
}

export function MarkdownRenderer({ 
  content, 
  searchTerms = [], 
  className = '', 
  maxHeight = 'max-h-96' 
}: MarkdownRendererProps) {
  // Function to highlight search terms in text nodes
  const highlightText = (text: string): string => {
    if (!searchTerms || searchTerms.length === 0) {
      return text;
    }
    
    let highlighted = text;
    
    for (const term of searchTerms) {
      if (term.trim().length < 2) continue;
      
      const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="search-highlight">$1</mark>');
    }
    
    return highlighted;
  };
  
  const escapeRegex = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
  
  return (
    <div className={`prose prose-sm max-w-none overflow-auto ${maxHeight} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom text renderer to support search highlighting
          text: ({ children }) => {
            const textContent = String(children);
            const highlighted = highlightText(textContent);
            
            if (highlighted !== textContent) {
              return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
            }
            
            return <>{children}</>;
          },
          
          // Enhanced code block styling
          code: ({ className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const hasPreParent = (props as any).node?.parent?.tagName === 'pre';
            
            if (hasPreParent && match) {
              return (
                <div className="relative">
                  <div className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                    {match[1]}
                  </div>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </div>
              );
            }
            
            return (
              <code 
                className={`${className || ''} px-1 py-0.5 bg-gray-100 text-gray-800 rounded text-sm`} 
                {...props}
              >
                {children}
              </code>
            );
          },
          
          // Enhanced link styling
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
              {...props}
            >
              {children}
            </a>
          ),
          
          // Enhanced table styling
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300" {...props}>
                {children}
              </table>
            </div>
          ),
          
          th: ({ children, ...props }) => (
            <th className="px-4 py-2 bg-gray-50 border border-gray-300 font-semibold text-left" {...props}>
              {children}
            </th>
          ),
          
          td: ({ children, ...props }) => (
            <td className="px-4 py-2 border border-gray-300" {...props}>
              {children}
            </td>
          ),
          
          // Enhanced blockquote styling
          blockquote: ({ children, ...props }) => (
            <blockquote 
              className="border-l-4 border-blue-500 pl-4 italic text-gray-600 bg-blue-50 py-2"
              {...props}
            >
              {children}
            </blockquote>
          ),
          
          // Enhanced heading styling with anchors
          h1: ({ children, ...props }) => (
            <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-4 pb-2 border-b border-gray-200" {...props}>
              {children}
            </h1>
          ),
          
          h2: ({ children, ...props }) => (
            <h2 className="text-xl font-bold text-gray-900 mt-5 mb-3" {...props}>
              {children}
            </h2>
          ),
          
          h3: ({ children, ...props }) => (
            <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2" {...props}>
              {children}
            </h3>
          ),
          
          // Enhanced list styling
          ul: ({ children, ...props }) => (
            <ul className="space-y-1 ml-4" {...props}>
              {children}
            </ul>
          ),
          
          ol: ({ children, ...props }) => (
            <ol className="space-y-1 ml-4" {...props}>
              {children}
            </ol>
          ),
          
          li: ({ children, ...props }) => (
            <li className="flex items-start" {...props}>
              <span className="mr-2 text-gray-400">•</span>
              <span>{children}</span>
            </li>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

interface CodeBlockProps {
  language: string;
  content: string;
  searchTerms?: string[];
  title?: string;
}

export function CodeBlock({ language, content, searchTerms = [], title }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };
  
  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-sm text-gray-300">
            {title || language || 'Code'}
          </span>
        </div>
        
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      
      {/* Code content */}
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm">
          <code className={`language-${language}`}>
            {content}
          </code>
        </pre>
      </div>
    </div>
  );
}

interface JsonViewerProps {
  data: any;
  searchTerms?: string[];
  maxHeight?: string;
}

export function JsonViewer({ data, searchTerms = [], maxHeight = 'max-h-96' }: JsonViewerProps) {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  
  const formattedJson = React.useMemo(() => {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
  }, [data]);
  
  return (
    <CodeBlock
      language="json"
      content={formattedJson}
      searchTerms={searchTerms}
      title="JSON Data"
    />
  );
}