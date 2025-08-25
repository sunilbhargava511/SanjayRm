'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, AlertTriangle, RefreshCw, Monitor } from 'lucide-react';
import type { Calculator } from '@/lib/database/schema';

interface CalculatorClientProps {
  calculator: Calculator;
}

export default function CalculatorClient({ calculator }: CalculatorClientProps) {
  const router = useRouter();
  const [iframeError, setIframeError] = useState(false);
  const [displayMode, setDisplayMode] = useState<'iframe' | 'standalone'>('iframe');
  const [standaloneUrl, setStandaloneUrl] = useState<string | null>(null);
  const [checkingStandalone, setCheckingStandalone] = useState(false);
  const [generatingStandalone, setGeneratingStandalone] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleIframeError = () => {
    setIframeError(true);
  };

  const handleExternalLink = () => {
    if (calculator?.url) {
      window.open(calculator.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Check if standalone calculator exists
  const checkStandaloneCalculator = async () => {
    if (calculator.calculatorType !== 'code') return;
    
    setCheckingStandalone(true);
    try {
      const response = await fetch(`/api/calculators/standalone?id=${calculator.id}`);
      const data = await response.json();
      
      if (data.success && data.exists) {
        setStandaloneUrl(data.standaloneUrl);
      }
    } catch (error) {
      console.error('Failed to check standalone calculator:', error);
    } finally {
      setCheckingStandalone(false);
    }
  };

  // Generate standalone calculator
  const generateStandaloneCalculator = async () => {
    setGeneratingStandalone(true);
    try {
      const response = await fetch('/api/calculators/standalone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          calculatorId: calculator.id,
          regenerate: true
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setStandaloneUrl(data.standaloneUrl);
        setDisplayMode('standalone');
      } else {
        console.error('Failed to generate standalone calculator:', data.error);
      }
    } catch (error) {
      console.error('Failed to generate standalone calculator:', error);
    } finally {
      setGeneratingStandalone(false);
    }
  };

  // Check for standalone on component mount
  useEffect(() => {
    if (calculator.calculatorType === 'code') {
      checkStandaloneCalculator();
    }
  }, [calculator.id]);

  const renderCalculatorContent = () => {
    // If it's a URL-based calculator
    if (calculator.calculatorType === 'url' && calculator.url) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Header with external link option */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {calculator.name}
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  {calculator.description}
                </p>
              </div>
              <button
                onClick={handleExternalLink}
                className="inline-flex items-center px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open External
              </button>
            </div>
          </div>

          {/* Embedded iframe */}
          <div className="relative" style={{ minHeight: '600px' }}>
            {!iframeError ? (
              <iframe
                src={calculator.url}
                className="w-full border-0"
                style={{ height: '600px' }}
                title={calculator.name}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                onError={handleIframeError}
                onLoad={() => setIframeError(false)}
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center p-8">
                  <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Cannot Embed Calculator
                  </h3>
                  <p className="text-gray-600 mb-4">
                    This calculator cannot be displayed in an embedded frame.
                  </p>
                  <button
                    onClick={handleExternalLink}
                    className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // If it's a code-based calculator
    if (calculator.calculatorType === 'code' && calculator.codeContent) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Header with display mode controls */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900">
                  {calculator.name}
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  {calculator.description}
                </p>
                {(calculator.calculatorType as string) === 'url' && calculator.url && (
                  <p className="text-xs text-gray-500 mt-2">
                    Calculator Link:{' '}
                    <a 
                      href={calculator.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-800"
                    >
                      {calculator.url}
                    </a>
                  </p>
                )}
              </div>
              
              {/* Display mode controls */}
              <div className="ml-4 flex flex-col sm:flex-row gap-2">
                {standaloneUrl && (
                  <div className="flex rounded-lg overflow-hidden border border-gray-300">
                    <button
                      onClick={() => setDisplayMode('iframe')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        displayMode === 'iframe'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Embedded
                    </button>
                    <button
                      onClick={() => setDisplayMode('standalone')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        displayMode === 'standalone'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Standalone
                    </button>
                  </div>
                )}
                
                {standaloneUrl && (
                  <button
                    onClick={() => window.open(standaloneUrl, '_blank')}
                    className="inline-flex items-center px-3 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open
                  </button>
                )}
                
                {!standaloneUrl && calculator.fileName && /\.(tsx|ts|jsx|js)$/.test(calculator.fileName) && (
                  <button
                    onClick={generateStandaloneCalculator}
                    disabled={generatingStandalone}
                    className="inline-flex items-center px-3 py-1 text-xs font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    {generatingStandalone ? (
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Monitor className="h-3 w-3 mr-1" />
                    )}
                    {generatingStandalone ? 'Generating...' : 'Generate Page'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Calculator content */}
          <div className="p-0">
            {displayMode === 'standalone' && standaloneUrl ? (
              <iframe
                src={standaloneUrl}
                className="w-full border-0"
                style={{ minHeight: '600px', height: '80vh' }}
                title={calculator.name}
              />
            ) : (
              <iframe
                srcDoc={calculator.codeContent}
                className="w-full border-0"
                style={{ minHeight: '600px', height: '80vh' }}
                title={calculator.name}
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            )}
          </div>
        </div>
      );
    }

    // Fallback for invalid calculator
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Invalid Calculator Configuration
        </h3>
        <p className="text-gray-600">
          This calculator is not properly configured.
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Calculators
            </button>
            
            <div className="text-sm text-gray-500">
              Financial Calculator
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {renderCalculatorContent()}
      </div>
    </div>
  );
}