import React, { useState, useEffect } from 'react';
import { Calculator as CalculatorIcon, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import CalculatorCard from './CalculatorCard';
import AppHeader from './AppHeader';
import { Calculator } from '@/types';

interface CalculatorsListProps {
  onBack: () => void;
  className?: string;
}

export default function CalculatorsList({ onBack, className = '' }: CalculatorsListProps) {
  const [calculators, setCalculators] = useState<Calculator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load calculators on component mount
  useEffect(() => {
    loadCalculators();
  }, []);

  const loadCalculators = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/calculators?activeOnly=true');
      
      if (!response.ok) {
        throw new Error(`Failed to load calculators: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load calculators');
      }
      
      setCalculators(data.calculators || []);
    } catch (error) {
      console.error('Error loading calculators:', error);
      setError(error instanceof Error ? error.message : 'Failed to load calculators');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    loadCalculators();
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 ${className}`}>
        <div className="max-w-6xl mx-auto">
          <AppHeader onClick={onBack} className="mb-6" />
          
          {/* Loading State */}
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Calculators</h3>
              <p className="text-gray-600">Please wait while we fetch the available financial calculators...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 ${className}`}>
        <div className="max-w-6xl mx-auto">
          <AppHeader onClick={onBack} className="mb-6" />
          
          {/* Error State */}
          <div className="flex items-center justify-center py-20">
            <div className="text-center max-w-md">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Calculators</h3>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 ${className}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <AppHeader onClick={onBack} className="mb-6" />
          
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          
          <div className="text-center mb-8">
            <CalculatorIcon className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Financial Calculators</h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Access powerful financial tools to help you make informed decisions about mortgages, retirement, investments, and more.
            </p>
          </div>
        </div>

        {/* Calculators Grid */}
        {calculators.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {calculators.map((calculator) => (
              <CalculatorCard
                key={calculator.id}
                calculator={calculator}
                className="transition-transform hover:scale-[1.02]"
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-16">
            <CalculatorIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Calculators Available</h3>
            <p className="text-gray-600 mb-6">
              Financial calculators will appear here once they are configured by the administrator.
            </p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        )}

        {/* Info Footer */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20 max-w-2xl mx-auto">
          <div className="text-center">
            <h3 className="font-semibold text-gray-900 mb-2">🔗 External Tools</h3>
            <p className="text-sm text-gray-600">
              These calculators open in new windows and are provided by trusted financial education websites. 
              They are safe to use and do not require any personal information from your current session.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}