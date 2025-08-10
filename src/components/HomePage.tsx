'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  BookOpen, 
  History, 
  User, 
  Mic,
  Bot,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Session } from '@/types';
import { EnhancedSessionStorage } from '@/lib/session-enhanced';
import ChatInterface from '@/components/chat/ChatInterface';
import VoiceSessionInterface from '@/components/VoiceSessionInterface';
import KnowledgeBase from '@/components/knowledge/KnowledgeBase';

type ViewType = 'home' | 'chat' | 'voice' | 'knowledge' | 'sessions';

export default function HomePage() {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);

  useEffect(() => {
    // Load recent sessions
    const sessions = EnhancedSessionStorage.getAllSessions().slice(0, 5);
    setRecentSessions(sessions);
  }, []);

  const handleStartNewSession = () => {
    EnhancedSessionStorage.createNewSession();
    setCurrentView('voice');
  };

  const handleLoadSession = () => {
    setCurrentView('chat');
  };

  const features = [
    {
      icon: <Mic className="w-6 h-6" />,
      title: 'Voice-First Interaction',
      description: 'Natural conversations with your AI advisor',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      icon: <Bot className="w-6 h-6" />,
      title: 'AI-Powered Advice',
      description: 'Get personalized guidance from Sanjay',
      color: 'bg-green-100 text-green-600'
    },
    {
      icon: <BookOpen className="w-6 h-6" />,
      title: 'Interactive Transcript',
      description: 'Real-time conversation notes and insights',
      color: 'bg-purple-100 text-purple-600'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Knowledge Base',
      description: 'Access comprehensive financial strategies',
      color: 'bg-orange-100 text-orange-600'
    }
  ];

  const expertiseAreas = [
    'Social Security Optimization',
    'Retirement Planning',
    'Investment Strategies',
    'Estate Planning',
    'Tax Efficiency',
    'Financial Psychology'
  ];

  if (currentView === 'voice') {
    return <VoiceSessionInterface onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'chat') {
    return <ChatInterface onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'knowledge') {
    return <KnowledgeBase onBack={() => setCurrentView('home')} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Version of Sanjay Bhargava</h1>
                <p className="text-gray-600">Retirement planning specialist with voice interaction</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentView('knowledge')}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <BookOpen className="w-5 h-5" />
                Knowledge Base
              </button>
              {recentSessions.length > 0 && (
                <button
                  onClick={() => setCurrentView('sessions')}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <History className="w-5 h-5" />
                  Sessions
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="relative inline-block">
            <div className="w-32 h-32 mx-auto mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full"></div>
              <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                <User className="w-16 h-16 text-blue-600" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center border-4 border-white">
                <Mic className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
          
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Meet Sanjay Bhargava
          </h2>
          <p className="text-xl text-gray-600 mb-2">
AI Retirement Planning Specialist
          </p>
          <p className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto">
            PayPal founding member and former SpaceX India head offering data-driven, practical financial guidance. 
            Specializing in achieving &quot;Zero Financial Anxiety&quot; through personalized strategies.
          </p>
          
          <div className="flex flex-col items-center gap-6">
            <button
              onClick={handleStartNewSession}
              className="flex items-center gap-3 px-12 py-6 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-2xl hover:shadow-3xl transform hover:scale-105 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Mic className="w-8 h-8 relative z-10" />
              <span className="relative z-10">Start Voice Session</span>
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse relative z-10"></div>
            </button>
            
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Voice Recognition Active</span>
              </div>
              <div className="w-1 h-4 bg-gray-300"></div>
              <button
                onClick={() => setCurrentView('knowledge')}
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Browse Articles
              </button>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.color}`}>
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Expertise Areas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Target className="w-6 h-6 text-blue-600" />
            <h3 className="text-2xl font-bold text-gray-900">Areas of Expertise</h3>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expertiseAreas.map((area, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="text-gray-700 font-medium">{area}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <History className="w-6 h-6 text-blue-600" />
                <h3 className="text-2xl font-bold text-gray-900">Recent Sessions</h3>
              </div>
              <button
                onClick={() => setCurrentView('sessions')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentSessions.slice(0, 3).map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleLoadSession()}
                  className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 line-clamp-1">{session.title}</h4>
                    <span className="text-xs text-gray-500">
                      {session.updatedAt.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <MessageCircle className="w-4 h-4" />
                    {session.messages.length} messages
                    {session.notes.length > 0 && (
                      <>
                        <BookOpen className="w-4 h-4 ml-2" />
                        {session.notes.length} notes
                      </>
                    )}
                  </div>
                  {session.summary && (
                    <p className="text-sm text-gray-600 line-clamp-2">{session.summary}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
            <Sparkles className="w-8 h-8 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-4">Ready to Achieve Zero Financial Anxiety?</h3>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              Start your personalized financial coaching session with voice interaction, 
              intelligent note-taking, and access to Sanjay&apos;s proven strategies.
            </p>
            <button
              onClick={handleStartNewSession}
              className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-gray-100 transition-colors shadow-lg"
            >
              Begin Your Session Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}