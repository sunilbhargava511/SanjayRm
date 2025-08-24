import React from 'react';
import { Calculator as CalculatorIcon, ExternalLink } from 'lucide-react';
import { Calculator } from '@/types';

interface CalculatorCardProps {
  calculator: Calculator;
  className?: string;
}

export default function CalculatorCard({ calculator, className = '' }: CalculatorCardProps) {
  const handleLaunchCalculator = () => {
    // Open calculator in new window/tab
    window.open(calculator.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      className={`group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-white/20 hover:border-blue-300 relative overflow-hidden ${className}`}
      onClick={handleLaunchCalculator}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-transparent rounded-full blur-2xl opacity-50"></div>
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
            <CalculatorIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-xs text-blue-600 font-medium bg-blue-100 px-3 py-1 rounded-full flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />
            External Tool
          </div>
        </div>
        
        {/* Title */}
        <h3 className="font-bold text-gray-900 mb-3 text-lg group-hover:text-blue-700 transition-colors">
          {calculator.name}
        </h3>
        
        {/* Description */}
        <p className="text-gray-600 mb-6 text-sm leading-relaxed line-clamp-3">
          {calculator.description}
        </p>
        
        {/* Launch Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CalculatorIcon className="w-4 h-4" />
            Financial Calculator
          </div>
          <div className="flex items-center gap-2 text-blue-600 font-medium text-sm group-hover:gap-3 transition-all">
            Launch Tool
            <ExternalLink className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Add line-clamp utility styles if not already available
// You may need to add this to your tailwind.config.js or global CSS
export const calculatorCardStyles = `
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;