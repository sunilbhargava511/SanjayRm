'use client';

import React from 'react';
import { Bot } from 'lucide-react';

interface AppHeaderProps {
  onClick?: () => void;
  className?: string;
}

export default function AppHeader({ onClick, className = '' }: AppHeaderProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: navigate to home
      window.location.href = '/';
    }
  };

  return (
    <div 
      className={`flex items-center gap-3 cursor-pointer group ${className}`}
      onClick={handleClick}
    >
      {/* Icon */}
      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
        <Bot className="w-6 h-6 text-white" />
      </div>
      
      {/* Text */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
          Sanjay AI
        </h1>
        <p className="text-sm text-gray-600">
          Financial Advisor
        </p>
      </div>
    </div>
  );
}