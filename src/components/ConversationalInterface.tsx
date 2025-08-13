'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, 
  MessageSquare,
  User,
  Bot
} from 'lucide-react';
import ConversationalAI from './ConversationalAI-RealFTherapy'; // Using REAL FTherapy pattern

interface ConversationSession {
  id: string;
  status: 'idle' | 'connecting' | 'active' | 'ended';
  startTime?: Date;
  endTime?: Date;
  transcript: TranscriptEntry[];
  duration: number;
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type ConnectionStatus = 'idle' | 'requesting_permission' | 'connecting' | 'connected' | 'disconnected' | 'error';

export default function ConversationalInterface() {
  const [session, setSession] = useState<ConversationSession>({
    id: `session_${Date.now()}`,
    status: 'idle',
    transcript: [],
    duration: 0
  });
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [showTranscript, setShowTranscript] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize educational session on component mount
  useEffect(() => {
    const initializeEducationalSession = async () => {
      try {
        // Check if educational session already exists
        const existingSessionId = localStorage.getItem('currentEducationalSessionId');
        if (existingSessionId) {
          console.log('Educational session already exists:', existingSessionId);
          setIsInitializing(false);
          return;
        }

        // Create a new educational session
        const response = await fetch('/api/educational-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            // No explicit personalization/conversation aware settings - will use admin defaults
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Store session ID in localStorage for the conversation interface
          localStorage.setItem('currentEducationalSessionId', data.session.id);
          
          // Store the conversation mode for the voice interface to use
          localStorage.setItem('conversationMode', data.conversationMode);
          
          if (data.conversationMode === 'open-ended') {
            // Structured conversation is disabled - notify user about open-ended conversation mode
            console.log('Structured conversation is disabled, starting open-ended conversation mode');
          }
          
          console.log('Educational session created successfully:', data.session.id);
        } else {
          // Generic error handling for actual failures
          const errorData = await response.json();
          console.error('Failed to create session:', errorData.error || 'Unknown error');
          setError(errorData.error || 'Failed to start session. Please try again.');
        }
      } catch (error) {
        console.error('Error creating educational session:', error);
        setError('Failed to start educational session. Please try again.');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeEducationalSession();
  }, []);
  
  // Handle new messages from ConversationalAI
  const handleMessage = useCallback((message: { role: 'user' | 'assistant'; content: string; timestamp: Date }) => {
    setSession(prev => ({
      ...prev,
      transcript: [...prev.transcript, message]
    }));
  }, []);

  // Handle connection status changes
  const handleStatusChange = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    
    // Update session status based on connection
    setSession(prev => {
      switch (status) {
        case 'connected':
          return {
            ...prev,
            status: 'active',
            startTime: prev.startTime || new Date()
          };
        case 'disconnected':
          return {
            ...prev,
            status: 'ended',
            endTime: new Date(),
            duration: prev.startTime ? 
              Math.floor((new Date().getTime() - prev.startTime.getTime()) / 1000) : 0
          };
        default:
          return prev;
      }
    });
  }, []);

  // Handle errors from ConversationalAI
  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    console.error('ConversationalInterface Error:', errorMessage);
  }, []);

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Initializing Session</h2>
          <p className="text-gray-600 mb-4">Setting up your conversation with Sanjay...</p>
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Main Conversation Interface */}
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-white/80 backdrop-blur-sm">
          <div></div> {/* Empty space for layout balance */}
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
              connectionStatus === 'connecting' || connectionStatus === 'requesting_permission' ? 'bg-yellow-100 text-yellow-800' :
              connectionStatus === 'error' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' || connectionStatus === 'requesting_permission' ? 'bg-yellow-500 animate-pulse' :
                connectionStatus === 'error' ? 'bg-red-500' :
                'bg-gray-400'
              }`} />
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'connecting' ? 'Connecting...' :
               connectionStatus === 'requesting_permission' ? 'Requesting Permission...' :
               connectionStatus === 'error' ? 'Error' :
               'Disconnected'}
            </div>
            
            {/* Conversation Mode Indicator */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {localStorage.getItem('conversationMode') === 'structured' ? (
                <>
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  📚 Structured Conversation
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  💬 Open-Ended Conversation
                </>
              )}
            </div>
            
            {session.duration > 0 && (
              <div className="text-sm text-gray-600">
                {formatDuration(session.duration)}
              </div>
            )}
          </div>
          
          <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <Settings className="w-5 h-5" />
            Settings
          </button>
        </div>

        {/* Main Conversation Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {/* Advisor Info */}
          <div className="text-center mb-12">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center mb-6 mx-auto">
              <User className="w-12 h-12 text-white" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Sanjay Bhargava</h1>
            <p className="text-gray-600 max-w-md mx-auto leading-relaxed mb-4">
              AI Financial Advisor - PayPal founding member offering data-driven, practical financial guidance. 
              Known for achieving "Zero Financial Anxiety" through personalized strategies.
            </p>
            
            <div className="flex items-center gap-2 justify-center text-sm text-blue-600">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>ElevenLabs Conversational AI</span>
            </div>
          </div>

          {/* ConversationalAI Component */}
          <ConversationalAI
            onMessage={handleMessage}
            onStatusChange={handleStatusChange}
            onError={handleError}
            className="mb-8"
          />

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg text-red-700 text-sm max-w-md text-center">
              {error}
            </div>
          )}
        </div>

        {/* Transcript Toggle */}
        <div className="p-4 bg-white/80 backdrop-blur-sm">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mx-auto"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Live Transcript</span>
            <span className="text-sm text-gray-500">
              {session.transcript.length} messages
            </span>
          </button>
        </div>

        {/* Live Transcript */}
        {showTranscript && (
          <div className="bg-white border-t max-h-60 overflow-y-auto">
            <div className="p-4 space-y-4">
              {session.transcript.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Transcript will appear as you talk</p>
                </div>
              ) : (
                session.transcript.map((entry, index) => {
                  const isUser = entry.role === 'user';
                  return (
                    <div
                      key={index}
                      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                      )}
                      
                      <div
                        className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                          isUser
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {entry.content}
                        <div className="text-xs opacity-75 mt-1">
                          {entry.timestamp.toLocaleTimeString()}
                        </div>
                      </div>

                      {isUser && (
                        <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}