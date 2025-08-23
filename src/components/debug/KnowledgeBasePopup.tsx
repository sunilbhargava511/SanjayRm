'use client';

import React, { useState, useMemo } from 'react';
import 'highlight.js/styles/github-dark.css';
import { BasePopup } from './PopupManager';
import { DatabaseDebugEntry } from '@/lib/debug-database-service';
import { Article } from '@/types';
import { Search, FileText, Eye, ExternalLink, Tag, Clock, Target, AlertTriangle, Code, Hash, Link, FileCode, Copy, CheckCircle } from 'lucide-react';
import { 
  formatContent, 
  extractSearchTerms, 
  highlightSearchTerms, 
  calculateRelevanceLevel,
  formatArticleMetadata,
  formatProcessingTime,
  detectSensitiveContent,
  createPreview
} from '@/lib/content-formatter';
import { MarkdownRenderer, CodeBlock, JsonViewer } from './MarkdownRenderer';

interface KnowledgeBasePopupProps {
  entry: DatabaseDebugEntry;
  onClose: () => void;
}

interface ContentViewerPopupProps {
  article: Article;
  onClose: () => void;
}

function ContentViewerPopup({ article, onClose }: ContentViewerPopupProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  
  const formattedContent = useMemo(() => formatContent(article.content), [article.content]);
  const metadata = useMemo(() => formatArticleMetadata(article), [article]);
  const sensitiveData = useMemo(() => detectSensitiveContent(article.content), [article.content]);
  
  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(article.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy content:', error);
    }
  };
  
  const getContentTypeIcon = () => {
    switch (formattedContent.analysis.type) {
      case 'json': return <Code className="w-4 h-4" />;
      case 'markdown': return <Hash className="w-4 h-4" />;
      case 'html': return <FileCode className="w-4 h-4" />;
      case 'url': return <Link className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };
  
  return (
    <BasePopup
      isOpen={true}
      onClose={onClose}
      title={`Full Content: ${article.title}`}
      size="full"
    >
      <div className="p-6">
        {/* Article Header */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>
            <div className="flex items-center gap-2">
              {/* Content Type Indicator */}
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                {getContentTypeIcon()}
                {formattedContent.analysis.type.toUpperCase()}
              </div>
              
              {/* Copy Button */}
              <button
                onClick={handleCopyContent}
                className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
              >
                {copySuccess ? (
                  <><CheckCircle className="w-4 h-4" /> Copied!</>
                ) : (
                  <><Copy className="w-4 h-4" /> Copy</>  
                )}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className={`flex items-center gap-1 px-2 py-1 rounded ${metadata.categoryColor}`}>
              <Tag className="w-4 h-4" />
              {article.category}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {metadata.formattedReadTime}
            </span>
            <span>Size: {metadata.formattedSize}</span>
            <span>By {article.author}</span>
            <span>Updated: {metadata.formattedDate}</span>
          </div>
          
          {/* Content Analysis */}
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span>Lines: {formattedContent.analysis.lineCount.toLocaleString()}</span>
            <span>Words: {formattedContent.analysis.wordCount.toLocaleString()}</span>
            <span>Type confidence: {Math.round(formattedContent.analysis.confidence * 100)}%</span>
            {formattedContent.analysis.hasCodeBlocks && <span className="text-blue-600">Contains code</span>}
            {formattedContent.analysis.hasMarkdownHeaders && <span className="text-green-600">Structured</span>}
          </div>
          
          {/* Sensitive Data Warning */}
          {sensitiveData.hasSensitiveData && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Sensitive Data Detected</span>
              </div>
              <div className="mt-1 text-xs text-amber-700">
                {sensitiveData.warnings.join(', ')}
              </div>
            </div>
          )}
          
          {article.summary && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-800 mb-1">Summary</h3>
              <p className="text-sm text-blue-700">{article.summary}</p>
            </div>
          )}
          
          {article.tags && article.tags.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1">
                {article.tags.map((tag, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Enhanced Article Content */}
        <div className="max-w-none">
          {formattedContent.shouldRenderAsMarkdown ? (
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                <Hash className="w-3 h-3" />
                Rendered Markdown Content
              </div>
              <MarkdownRenderer 
                content={formattedContent.formatted}
                searchTerms={extractSearchTerms(article.title + ' ' + (article.summary || ''))}
                className="bg-white rounded p-3 border content-scroll"
                maxHeight="max-h-[70vh]"
              />
            </div>
          ) : formattedContent.analysis.type === 'json' ? (
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                <Code className="w-3 h-3" />
                JSON Data Viewer
              </div>
              <JsonViewer 
                data={formattedContent.formatted}
                maxHeight="max-h-[70vh]"
              />
            </div>
          ) : formattedContent.shouldHighlightSyntax ? (
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                <Code className="w-3 h-3" />
                {formattedContent.analysis.type.toUpperCase()} Code
              </div>
              <CodeBlock
                language={formattedContent.analysis.type}
                content={formattedContent.formatted}
                title={`${formattedContent.analysis.type.toUpperCase()} Content`}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg p-4 border">
              <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Plain Text Content
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 content-scroll max-h-[70vh] overflow-y-auto">
                <span dangerouslySetInnerHTML={{ 
                  __html: highlightSearchTerms(formattedContent.formatted, extractSearchTerms(article.title + ' ' + (article.summary || '')))
                }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </BasePopup>
  );
}

export function KnowledgeBasePopup({ entry, onClose }: KnowledgeBasePopupProps) {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  
  // Get knowledge base context and cited articles
  const knowledgeContext = entry.request.knowledgeContext || '';
  const citedArticles = entry.response.citedArticles || [];
  
  // Extract and analyze search query
  const searchAnalysis = useMemo(() => {
    // Try to find the last user message as the likely search query
    const userMessages = entry.request.messages.filter(m => (m.sender || m.type) === 'user');
    let query = 'Unable to determine search query';
    
    if (userMessages.length > 0) {
      const lastUserMessage = userMessages[userMessages.length - 1];
      query = lastUserMessage.content.substring(0, 200); // Increased to 200 chars
    }
    
    const searchTerms = extractSearchTerms(query);
    
    return {
      query,
      searchTerms,
      formattedQuery: createPreview(query, {
        maxLength: 150,
        preferParagraphs: false,
        preserveStructure: false,
        addEllipsis: true,
        respectWordBoundaries: true
      })
    };
  }, [entry.request.messages]);
  
  // Format knowledge context if available
  const formattedKnowledgeContext = useMemo(() => {
    if (!knowledgeContext) return null;
    return formatContent(knowledgeContext);
  }, [knowledgeContext]);
  
  // Enhanced content analysis for articles
  const analyzeArticleContent = useMemo(() => {
    return citedArticles.map(article => {
      const formatted = formatContent(article.content);
      const metadata = formatArticleMetadata(article);
      const relevance = calculateRelevanceLevel(article.content, searchAnalysis.searchTerms);
      const sensitiveData = detectSensitiveContent(article.content);
      
      return {
        article,
        formatted,
        metadata,
        relevance,
        sensitiveData
      };
    });
  }, [citedArticles, searchAnalysis.searchTerms]);
  
  return (
    <>
      <BasePopup
        isOpen={true}
        onClose={onClose}
        title="Knowledge Base Context"
        size="large"
      >
        <div className="p-6">
          {/* Enhanced Search Context */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-800">Search Context</h3>
            </div>
            
            <div className="space-y-3 text-sm">
              {/* Query Display */}
              <div>
                <span className="font-medium text-blue-700">Query that triggered search:</span>
                <div className="text-blue-600 bg-white p-3 rounded border mt-1">
                  <div className="italic mb-2">"{searchAnalysis.formattedQuery}"</div>
                  {searchAnalysis.searchTerms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-blue-500">Search terms:</span>
                      {searchAnalysis.searchTerms.map((term, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {term}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Enhanced Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-2 bg-white rounded border">
                  <div className="text-xs text-gray-500">Articles Found</div>
                  <div className="font-semibold text-blue-700">{citedArticles.length}</div>
                </div>
                <div className="p-2 bg-white rounded border">
                  <div className="text-xs text-gray-500">Request Type</div>
                  <div className="font-semibold text-blue-700">{entry.type.toUpperCase()}</div>
                </div>
                <div className="p-2 bg-white rounded border">
                  <div className="text-xs text-gray-500">Processing Time</div>
                  <div className="font-semibold text-blue-700">{formatProcessingTime(entry.response.processingTime)}</div>
                </div>
                <div className="p-2 bg-white rounded border">
                  <div className="text-xs text-gray-500">Status</div>
                  <div className={`font-semibold ${
                    entry.status === 'success' ? 'text-green-700' :
                    entry.status === 'error' ? 'text-red-700' : 'text-yellow-700'
                  }`}>
                    {entry.status.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Articles List */}
          {citedArticles.length === 0 ? (
            <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No knowledge base articles were used</p>
                {knowledgeContext && (
                  <p className="text-xs text-gray-400 mt-1">But knowledge context was provided</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Retrieved Articles ({citedArticles.length})
              </h3>
              
              {analyzeArticleContent.map(({ article, formatted, metadata, relevance, sensitiveData }, index) => {
                const highlightedPreview = highlightSearchTerms(formatted.preview, searchAnalysis.searchTerms);
                
                return (
                  <div key={article.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                    {/* Article Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-lg font-medium text-gray-900">{article.title}</h4>
                          
                          {/* Content Type Badge */}
                          <span className={`px-2 py-1 text-xs rounded font-medium ${
                            formatted.analysis.type === 'markdown' ? 'bg-green-100 text-green-800' :
                            formatted.analysis.type === 'json' ? 'bg-blue-100 text-blue-800' :
                            formatted.analysis.type === 'html' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {formatted.analysis.type.toUpperCase()}
                          </span>
                          
                          {/* Relevance Badge */}
                          <span className={`px-2 py-1 text-xs rounded font-medium ${
                            relevance.level === 'high' ? 'bg-green-100 text-green-800' :
                            relevance.level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {relevance.level.toUpperCase()} RELEVANCE
                          </span>
                          
                          {/* Sensitive Data Warning */}
                          {sensitiveData.hasSensitiveData && (
                            <span className="px-2 py-1 text-xs rounded font-medium bg-red-100 text-red-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              SENSITIVE
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                          <span className={`flex items-center gap-1 px-2 py-1 rounded ${metadata.categoryColor}`}>
                            <Tag className="w-4 h-4" />
                            {article.category}
                          </span>
                          <span>Size: {metadata.formattedSize}</span>
                          <span>Read time: {metadata.formattedReadTime}</span>
                          <span>Words: {formatted.analysis.wordCount.toLocaleString()}</span>
                        </div>
                        
                        {/* Enhanced Relevance Indicators */}
                        <div className="flex items-center gap-2 mb-3">
                          <Target className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-700">Relevance Score:</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${
                                  relevance.level === 'high' ? 'bg-green-500' :
                                  relevance.level === 'medium' ? 'bg-yellow-500' : 'bg-gray-400'
                                }`}
                                style={{ width: `${Math.max(10, relevance.score * 1000)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {(relevance.score * 100).toFixed(1)}%
                            </span>
                          </div>
                          {relevance.matches.length > 0 && (
                            <div className="flex gap-1">
                              {relevance.matches.slice(0, 3).map((match, i) => (
                                <span key={i} className="px-1 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                  {match.term} ({match.count})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setSelectedArticle(article)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Full Content
                      </button>
                    </div>
                    
                    {/* Enhanced Content Preview */}
                    <div className="space-y-3">
                      {article.summary && (
                        <div className="p-3 bg-gray-50 rounded">
                          <div className="text-sm font-medium text-gray-700 mb-1">Summary</div>
                          <div className="text-sm text-gray-600">
                            <span dangerouslySetInnerHTML={{ 
                              __html: highlightSearchTerms(article.summary, searchAnalysis.searchTerms) 
                            }} />
                          </div>
                        </div>
                      )}
                      
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            Content Preview
                            {formatted.analysis.type === 'json' && <Code className="w-3 h-3" />}
                            {formatted.analysis.type === 'markdown' && <Hash className="w-3 h-3" />}
                            {formatted.analysis.hasCodeBlocks && <FileCode className="w-3 h-3 text-blue-500" />}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs flex items-center gap-1 ${
                              formatted.analysis.confidence > 0.8 ? 'text-green-600' :
                              formatted.analysis.confidence > 0.5 ? 'text-yellow-600' : 'text-gray-600'
                            }`}>
                              <FileText className="w-3 h-3" />
                              {Math.round(formatted.analysis.confidence * 100)}% confidence
                            </span>
                          </div>
                        </div>
                        
                        {/* Enhanced Content Preview */}
                        <div className="text-sm leading-relaxed">
                          {formatted.shouldRenderAsMarkdown ? (
                            <div className="bg-white border rounded p-2">
                              <MarkdownRenderer 
                                content={formatted.preview}
                                searchTerms={searchAnalysis.searchTerms}
                                className="prose-sm"
                                maxHeight="max-h-32"
                              />
                            </div>
                          ) : formatted.analysis.type === 'json' ? (
                            <div className="bg-gray-900 text-green-400 p-2 rounded font-mono text-xs">
                              <pre className="whitespace-pre-wrap overflow-hidden">
                                {formatted.preview}
                              </pre>
                            </div>
                          ) : formatted.shouldHighlightSyntax ? (
                            <div className="bg-gray-900 text-green-400 p-2 rounded font-mono text-xs">
                              <pre className="whitespace-pre-wrap">{formatted.preview}</pre>
                            </div>
                          ) : (
                            <div className="text-gray-600">
                              <span dangerouslySetInnerHTML={{ 
                                __html: highlightedPreview
                              }} />
                            </div>
                          )}
                          
                          {formatted.preview.length < formatted.original.length && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <button
                                onClick={() => setSelectedArticle(article)}
                                className="text-blue-600 font-medium hover:text-blue-800 hover:underline text-xs"
                              >
                                View full content ({Math.round((formatted.original.length - formatted.preview.length) / 1000)}k more characters)
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Content Analysis Footer */}
                        <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-3 text-xs text-gray-500">
                          <span>Lines: {formatted.analysis.lineCount}</span>
                          <span>Words: {formatted.analysis.wordCount}</span>
                          {formatted.analysis.hasMarkdownHeaders && (
                            <span className="text-green-600">Structured</span>
                          )}
                          {formatted.analysis.hasUrls && (
                            <span className="text-blue-600">Contains URLs</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Tags */}
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {article.tags.map((tag, tagIndex) => (
                            <span 
                              key={tagIndex}
                              className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Source Information */}
                      <div className="pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-500 space-y-1">
                          <div><strong>Source ID:</strong> {article.id}</div>
                          <div><strong>Last Updated:</strong> {new Date(article.lastUpdated).toLocaleDateString()}</div>
                          <div><strong>Author:</strong> {article.author}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Enhanced Knowledge Context */}
          {formattedKnowledgeContext && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                  Raw Knowledge Context
                  <span className={`px-2 py-1 text-xs rounded ${
                    formattedKnowledgeContext.analysis.type === 'json' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {formattedKnowledgeContext.analysis.type.toUpperCase()}
                  </span>
                </h3>
                <div className="text-xs text-yellow-600">
                  {formattedKnowledgeContext.analysis.wordCount} words, {formattedKnowledgeContext.analysis.lineCount} lines
                </div>
              </div>
              
              <div className="text-sm max-h-40 overflow-y-auto content-scroll">
                {formattedKnowledgeContext.shouldRenderAsMarkdown ? (
                  <MarkdownRenderer 
                    content={formattedKnowledgeContext.preview}
                    searchTerms={searchAnalysis.searchTerms}
                    className="bg-white rounded p-2 prose-sm"
                    maxHeight="max-h-32"
                  />
                ) : formattedKnowledgeContext.analysis.type === 'json' ? (
                  <JsonViewer 
                    data={formattedKnowledgeContext.formatted.length > 1000 
                      ? formattedKnowledgeContext.preview
                      : formattedKnowledgeContext.formatted
                    }
                    maxHeight="max-h-32"
                  />
                ) : formattedKnowledgeContext.shouldHighlightSyntax ? (
                  <CodeBlock
                    language={formattedKnowledgeContext.analysis.type}
                    content={formattedKnowledgeContext.formatted.length > 1000 
                      ? formattedKnowledgeContext.preview
                      : formattedKnowledgeContext.formatted
                    }
                    title="Raw Context Data"
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-yellow-700 bg-white p-2 rounded">
                    <span dangerouslySetInnerHTML={{ 
                      __html: highlightSearchTerms(
                        formattedKnowledgeContext.formatted.length > 1000 
                          ? formattedKnowledgeContext.preview
                          : formattedKnowledgeContext.formatted,
                        searchAnalysis.searchTerms
                      )
                    }} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </BasePopup>
      
      {/* Content Viewer Popup */}
      {selectedArticle && (
        <ContentViewerPopup
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
        />
      )}
    </>
  );
}