'use client';

import React, { useState, useEffect } from 'react';
import { Save, Upload, Link, Code, AlertTriangle, CheckCircle, Eye, Globe, Zap } from 'lucide-react';
import CodeEditor from './CodeEditor';
import { ClaudeArtifactProcessor, claudeArtifactUtils } from '@/lib/claude-artifact-processor';
import type { Calculator } from '@/lib/database/schema';

interface EnhancedCalculatorFormProps {
  calculator?: Calculator | null;
  onSave: (calculatorData: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

type CalculatorMode = 'url' | 'code' | 'auto';

export default function EnhancedCalculatorForm({ 
  calculator, 
  onSave, 
  onCancel, 
  isLoading = false 
}: EnhancedCalculatorFormProps) {
  const [mode, setMode] = useState<CalculatorMode>('url');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    url: '',
    codeContent: '',
    artifactUrl: '',
    isPublished: true
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<{
    success: boolean;
    title?: string;
    content?: string;
    errors?: string[];
    warnings?: string[];
  } | null>(null);
  const [urlValidation, setUrlValidation] = useState<{
    isValid: boolean;
    isClaudeArtifact: boolean;
    message?: string;
  } | null>(null);

  // Initialize form data
  useEffect(() => {
    if (calculator) {
      setFormData({
        name: calculator.name || '',
        description: calculator.description || '',
        url: calculator.url || '',
        codeContent: calculator.codeContent || '',
        artifactUrl: calculator.artifactUrl || '',
        isPublished: calculator.isPublished !== false
      });
      setMode(calculator.calculatorType === 'code' ? 'code' : 'url');
    }
  }, [calculator]);

  // Validate URL input
  useEffect(() => {
    if (formData.url) {
      const isValidUrl = /^https?:\/\/.+/.test(formData.url);
      const isClaudeArtifact = claudeArtifactUtils.isClaudeUrl(formData.url);
      
      setUrlValidation({
        isValid: isValidUrl,
        isClaudeArtifact,
        message: isClaudeArtifact 
          ? 'Claude artifact detected - can be processed for local deployment'
          : isValidUrl 
            ? 'Valid URL - will be embedded or linked externally'
            : 'Please enter a valid URL starting with http:// or https://'
      });
    } else {
      setUrlValidation(null);
    }
  }, [formData.url]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const processClaudeArtifact = async () => {
    if (!formData.url || !claudeArtifactUtils.isClaudeUrl(formData.url)) return;
    
    try {
      setIsProcessing(true);
      setProcessingResult(null);

      // Fetch artifact content
      const artifact = await ClaudeArtifactProcessor.fetchArtifactContent(formData.url);
      if (!artifact) {
        throw new Error('Could not fetch Claude artifact content');
      }

      // Process for deployment
      const processed = ClaudeArtifactProcessor.processArtifactForDeployment(artifact);
      
      if (processed.hasErrors) {
        setProcessingResult({
          success: false,
          errors: processed.errors,
          warnings: processed.warnings
        });
        return;
      }

      // Auto-populate form fields
      setFormData(prev => ({
        ...prev,
        name: prev.name || processed.title,
        codeContent: processed.htmlContent,
        artifactUrl: formData.url
      }));

      // Switch to code mode
      setMode('code');

      setProcessingResult({
        success: true,
        title: processed.title,
        content: processed.htmlContent,
        warnings: processed.warnings
      });

    } catch (error) {
      setProcessingResult({
        success: false,
        errors: [error instanceof Error ? error.message : 'Failed to process Claude artifact']
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.name.trim()) {
      errors.push('Calculator name is required');
    }
    
    if (!formData.description.trim()) {
      errors.push('Description is required');
    }
    
    if (mode === 'url' && !formData.url.trim()) {
      errors.push('URL is required for URL-based calculators');
    }
    
    if (mode === 'code' && !formData.codeContent.trim()) {
      errors.push('Code content is required for code-based calculators');
    }
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setProcessingResult({
        success: false,
        errors: validationErrors
      });
      return;
    }

    const calculatorData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      calculatorType: mode,
      isPublished: formData.isPublished,
      ...(mode === 'url' ? {
        url: formData.url.trim(),
        artifactUrl: formData.artifactUrl || null,
        codeContent: null
      } : {
        codeContent: formData.codeContent,
        artifactUrl: formData.artifactUrl || null,
        url: null
      })
    };

    try {
      await onSave(calculatorData);
    } catch (error) {
      setProcessingResult({
        success: false,
        errors: [error instanceof Error ? error.message : 'Failed to save calculator']
      });
    }
  };

  const validateCode = (code: string) => {
    const validation = claudeArtifactUtils.validateHtml(code);
    return {
      valid: validation.valid,
      errors: validation.valid ? [] : validation.issues,
      warnings: validation.issues.filter(issue => !issue.includes('Missing') && !issue.includes('Potential XSS'))
    };
  };

  return (
    <form onSubmit={handleSubmit} className="bg-purple-50 p-6 rounded-lg mb-6 border border-purple-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {calculator ? 'Edit Calculator' : 'Add New Calculator'}
      </h3>

      {/* Mode Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Calculator Type
        </label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
              mode === 'url'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Globe className="h-4 w-4" />
            External URL
          </button>
          <button
            type="button"
            onClick={() => setMode('code')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
              mode === 'code'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Code className="h-4 w-4" />
            Custom Code
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {mode === 'url' 
            ? 'Link to external calculators or Claude artifacts'
            : 'Deploy custom calculator code on your server'
          }
        </p>
      </div>

      {/* Basic Information */}
      <div className="grid grid-cols-1 gap-4 mb-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Calculator Name *
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="e.g., Investment Growth Calculator"
            required
          />
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={3}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="Describe what this calculator does and how it helps users..."
            required
          />
        </div>
      </div>

      {/* URL Mode */}
      {mode === 'url' && (
        <div className="mb-6">
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
            Calculator URL *
          </label>
          <div className="relative">
            <input
              type="url"
              id="url"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              className="w-full p-3 pr-12 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="https://claude.ai/public/artifacts/... or https://example.com/calculator"
              required
            />
            {urlValidation?.isClaudeArtifact && (
              <button
                type="button"
                onClick={processClaudeArtifact}
                disabled={isProcessing}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                title="Process Claude artifact for local deployment"
              >
                <Zap className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {urlValidation && (
            <div className={`mt-2 p-3 rounded-md text-sm ${
              urlValidation.isValid 
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {urlValidation.isValid ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {urlValidation.message}
              </div>
              {urlValidation.isClaudeArtifact && (
                <div className="mt-2 text-xs">
                  Click the ⚡ button to extract and deploy locally, or keep as external link.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Code Mode */}
      {mode === 'code' && (
        <div className="mb-6">
          <CodeEditor
            value={formData.codeContent}
            onChange={(value) => handleInputChange('codeContent', value)}
            title="Calculator HTML Code"
            placeholder="Paste your complete HTML calculator code here..."
            showPreview={true}
            onValidate={validateCode}
          />
          
          {formData.artifactUrl && (
            <div className="mt-2 text-xs text-gray-500">
              Original Claude artifact: {' '}
              <a 
                href={formData.artifactUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-600 hover:text-purple-800"
              >
                {formData.artifactUrl}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Publishing Options */}
      <div className="mb-6">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.isPublished}
            onChange={(e) => handleInputChange('isPublished', e.target.checked.toString())}
            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Publish calculator (make available to users)
          </span>
        </label>
      </div>

      {/* Processing Results */}
      {processingResult && (
        <div className={`mb-6 p-4 rounded-md border ${
          processingResult.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          {processingResult.success ? (
            <div>
              <div className="flex items-center gap-2 text-green-800 mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Processing successful!</span>
              </div>
              {processingResult.warnings && processingResult.warnings.length > 0 && (
                <div className="text-sm text-orange-700 mt-2">
                  <p className="font-medium mb-1">Warnings:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {processingResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-red-800 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Processing failed</span>
              </div>
              {processingResult.errors && (
                <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                  {processingResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Form Actions */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isLoading || isProcessing}
          className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {calculator ? 'Update Calculator' : 'Add Calculator'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading || isProcessing}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
            Processing...
          </div>
        )}
      </div>
    </form>
  );
}