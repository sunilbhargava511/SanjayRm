import React from 'react';
import { Calculator as CalculatorIcon, ExternalLink, Code, Globe, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Calculator } from '@/types';

interface CalculatorCardProps {
  calculator: Calculator;
  className?: string;
}

export default function CalculatorCard({ calculator, className = '' }: CalculatorCardProps) {
  const router = useRouter();

  const handleLaunchCalculator = () => {
    if (calculator.calculatorType === 'code') {
      // Navigate to the hosted calculator page
      router.push(`/calculators/${calculator.id}`);
    } else if (calculator.url) {
      // Open external URL in new window/tab
      window.open(calculator.url, '_blank', 'noopener,noreferrer');
    }
  };

  const getCalculatorTypeInfo = () => {
    if (calculator.calculatorType === 'code') {
      return {
        icon: Code,
        label: 'Hosted Tool',
        color: 'purple',
        isExternal: false
      };
    } else if (calculator.artifactUrl) {
      return {
        icon: Zap,
        label: 'Claude Artifact',
        color: 'blue',
        isExternal: true
      };
    } else {
      return {
        icon: Globe,
        label: 'External Tool',
        color: 'blue',
        isExternal: true
      };
    }
  };

  const typeInfo = getCalculatorTypeInfo();

  const colorVariants = {
    purple: {
      border: 'hover:border-purple-300',
      bg: 'from-purple-100 to-purple-200',
      text: 'text-purple-600',
      badge: 'text-purple-600 bg-purple-100',
      hover: 'group-hover:text-purple-700',
      decoration: 'from-purple-100'
    },
    blue: {
      border: 'hover:border-blue-300', 
      bg: 'from-blue-100 to-blue-200',
      text: 'text-blue-600',
      badge: 'text-blue-600 bg-blue-100', 
      hover: 'group-hover:text-blue-700',
      decoration: 'from-blue-100'
    }
  };

  const colors = colorVariants[typeInfo.color as keyof typeof colorVariants];
  const TypeIcon = typeInfo.icon;

  return (
    <div 
      className={`group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-white/20 ${colors.border} relative overflow-hidden ${className}`}
      onClick={handleLaunchCalculator}
    >
      {/* Background decoration */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colors.decoration} to-transparent rounded-full blur-2xl opacity-50`}></div>
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 bg-gradient-to-br ${colors.bg} rounded-xl flex items-center justify-center`}>
            <CalculatorIcon className={`w-6 h-6 ${colors.text}`} />
          </div>
          <div className={`text-xs font-medium ${colors.badge} px-3 py-1 rounded-full flex items-center gap-1`}>
            <TypeIcon className="w-3 h-3" />
            {typeInfo.label}
          </div>
        </div>
        
        {/* Title */}
        <h3 className={`font-bold text-gray-900 mb-3 text-lg ${colors.hover} transition-colors`}>
          {calculator.name}
        </h3>
        
        {/* Description */}
        <p className="text-gray-600 mb-6 text-sm leading-relaxed line-clamp-3">
          {calculator.description}
        </p>

        {/* Additional metadata for code-based calculators */}
        {calculator.calculatorType === 'code' && calculator.artifactUrl && (
          <div className="mb-4 text-xs text-gray-500 bg-gray-50 rounded-md p-2">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span>Originally created with Claude AI</span>
            </div>
          </div>
        )}
        
        {/* Launch Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CalculatorIcon className="w-4 h-4" />
            Financial Calculator
            {!calculator.isPublished && (
              <span className="text-orange-500 font-medium">(Draft)</span>
            )}
          </div>
          <div className={`flex items-center gap-2 ${colors.text} font-medium text-sm group-hover:gap-3 transition-all`}>
            {typeInfo.isExternal ? 'Launch Tool' : 'Open Calculator'}
            {typeInfo.isExternal ? (
              <ExternalLink className="w-4 h-4" />
            ) : (
              <CalculatorIcon className="w-4 h-4" />
            )}
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