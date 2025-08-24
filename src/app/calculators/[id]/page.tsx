'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, AlertTriangle, Clock } from 'lucide-react';
import type { Calculator } from '@/lib/database/schema';

interface CalculatorPageProps {
  params: {
    id: string;
  };
}

export default function CalculatorPage({ params }: CalculatorPageProps) {
  const router = useRouter();
  const [calculator, setCalculator] = useState<Calculator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    fetchCalculator();
  }, [params.id]);

  const fetchCalculator = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/calculators/${params.id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch calculator: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load calculator');
      }
      
      setCalculator(data.calculator);
    } catch (err) {
      console.error('Error fetching calculator:', err);
      setError(err instanceof Error ? err.message : 'Failed to load calculator');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading calculator...</p>
        </div>
      </div>
    );
  }

  if (error || !calculator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Calculator Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            {error || 'The requested calculator could not be loaded.'}
          </p>
          <button
            onClick={handleBack}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check if calculator is published
  if (!calculator.isPublished) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Clock className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Calculator Not Available
          </h2>
          <p className="text-gray-600 mb-6">
            This calculator is currently unpublished and not available for use.
          </p>
          <button
            onClick={handleBack}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

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
          {/* Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {calculator.name}
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {calculator.description}
            </p>
            {calculator.artifactUrl && (
              <p className="text-xs text-gray-500 mt-2">
                Originally created with{' '}
                <a 
                  href={calculator.artifactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-800"
                >
                  Claude AI
                </a>
              </p>
            )}
          </div>

          {/* Calculator content */}
          <div className="p-0">
            <iframe
              srcDoc={calculator.codeContent}
              className="w-full border-0"
              style={{ minHeight: '600px', height: '80vh' }}
              title={calculator.name}
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
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

// Add error boundary for better error handling
export function CalculatorErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading calculator...</p>
        </div>
      </div>
    }>
      {children}
    </React.Suspense>
  );
}