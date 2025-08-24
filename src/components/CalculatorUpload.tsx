import React, { useState } from 'react';
import { Upload, Link, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface CalculatorUploadProps {
  onUploadSuccess?: (calculator: any) => void;
  className?: string;
}

export default function CalculatorUpload({ onUploadSuccess, className = '' }: CalculatorUploadProps) {
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [artifactUrl, setArtifactUrl] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    setFile(selectedFile || null);
    setError(null);
    
    if (selectedFile && !name) {
      // Auto-populate name from filename
      const fileName = selectedFile.name.replace(/\.(tsx|ts|jsx|js|html|htm)$/i, '');
      setName(fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/[-_]/g, ' '));
    }
  };

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setArtifactUrl(event.target.value);
    setError(null);
    
    // Auto-populate name if empty and it's a Claude artifact
    if (event.target.value.includes('claude.ai') && !name) {
      setName('Claude Artifact Calculator');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);

      if (uploadMode === 'file') {
        if (!file) {
          throw new Error('Please select a file to upload');
        }
        formData.append('file', file);
      } else {
        if (!artifactUrl) {
          throw new Error('Please provide a Claude artifact URL');
        }
        formData.append('artifactUrl', artifactUrl);
      }

      const response = await fetch('/api/calculators/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setSuccess('Calculator uploaded successfully!');
      setFile(null);
      setArtifactUrl('');
      setName('');
      setDescription('');
      
      if (onUploadSuccess) {
        onUploadSuccess(data.calculator);
      }

      // Reset form
      const fileInput = document.getElementById('fileInput') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Upload className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Upload Calculator</h3>
          <p className="text-sm text-gray-600">Add a new calculator from file or Claude artifact</p>
        </div>
      </div>

      {/* Upload Mode Toggle */}
      <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
        <button
          type="button"
          onClick={() => setUploadMode('file')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            uploadMode === 'file'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setUploadMode('url')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            uploadMode === 'url'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Link className="w-4 h-4" />
          Claude Artifact
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Upload Input */}
        {uploadMode === 'file' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Calculator File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
              <input
                id="fileInput"
                type="file"
                accept=".tsx,.ts,.jsx,.js,.html,.htm"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="fileInput" className="cursor-pointer">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {file ? file.name : 'Click to select file or drag and drop'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supports: .tsx, .ts, .jsx, .js, .html, .htm
                </p>
              </label>
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="artifactUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Claude Artifact URL
            </label>
            <input
              id="artifactUrl"
              type="url"
              value={artifactUrl}
              onChange={handleUrlChange}
              placeholder="https://claude.ai/public/artifacts/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required={uploadMode === 'url'}
            />
          </div>
        )}

        {/* Name and Description */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Calculator Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter calculator name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter calculator description"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isUploading || (!file && !artifactUrl) || !name || !description}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload Calculator
            </>
          )}
        </button>
      </form>
    </div>
  );
}