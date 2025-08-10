'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Settings, 
  Volume2, 
  ArrowLeft, 
  MessageSquare,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  User,
  Bot
} from 'lucide-react';
import { Message, Session } from '@/types';
import { EnhancedSessionStorage } from '@/lib/session-enhanced';
import { VoiceService, VoiceInputService } from '@/lib/voice-services';

interface VoiceSessionInterfaceProps {
  onBack?: () => void;
}

export default function VoiceSessionInterface({ onBack }: VoiceSessionInterfaceProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [hasPlayedIntro, setHasPlayedIntro] = useState(false);
  
  const voiceService = useRef<VoiceService | null>(null);
  const voiceInput = useRef<VoiceInputService | null>(null);
  const hasPlayedIntroRef = useRef(false);

  // Initialize services (FTherapy pattern)
  useEffect(() => {
    try {
      // Only initialize if services don't exist
      if (!voiceService.current) {
        voiceService.current = new VoiceService(); // ElevenLabs only
      }
      if (!voiceInput.current) {
        voiceInput.current = new VoiceInputService({
          language: 'en-US',
          continuous: true,
          interimResults: true
        });
      }

      // Reset session state
      setSession(null);
      setHasPlayedIntro(false);
      hasPlayedIntroRef.current = false;
      
      // Load or create session
      let currentSession = EnhancedSessionStorage.getCurrentSession();
      if (!currentSession) {
        currentSession = EnhancedSessionStorage.createNewSession();
      }
      setSession(currentSession);
    } catch (error) {
      console.error('Error initializing session:', error);
    }
  }, []);

  // Handle introduction playback - play immediately when session is ready
  useEffect(() => {
    if (!session || !voiceService.current || hasPlayedIntroRef.current) {
      return;
    }

    // Play introduction if new session (no messages)
    if (session.messages.length === 0) {
      hasPlayedIntroRef.current = true;
      setHasPlayedIntro(true);
      
      const playIntroduction = async () => {
        try {
          setIsSpeaking(true);
          
          // Get introduction from API
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [],
              query: 'Hello',
              isVoiceInput: true,
              generateIntro: true
            }),
          });

          const data = await response.json();
          
          if (data.success) {
            const introMessage: Message = {
              id: `intro_${Date.now()}`,
              type: 'assistant',
              content: data.response,
              timestamp: new Date()
            };
            
            // Add message to session
            EnhancedSessionStorage.addMessage(session.id, introMessage);
            const updatedSession = EnhancedSessionStorage.getSession(session.id);
            if (updatedSession) {
              setSession(updatedSession);
            }
            
            // Speak the introduction
            await voiceService.current!.speak(data.response, 'professional');
          }
        } catch (error) {
          console.error('Introduction failed:', error);
        } finally {
          setIsSpeaking(false);
        }
      };

      // Play introduction immediately
      playIntroduction();
    } else {
      // Session already has messages, don't play intro
      hasPlayedIntroRef.current = true;
      setHasPlayedIntro(true);
    }
  }, [session]); // Only depend on session to avoid re-triggering

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (voiceService.current) {
        voiceService.current.interruptAll();
      }
      if (voiceInput.current) {
        voiceInput.current.stopListening();
      }
    };
  }, []);

  const handleUserMessage = useCallback(async (content: string) => {
    if (!session || !voiceService.current) return;
    
    try {
      // Add user message
      const userMessage: Message = {
        id: `msg_${Date.now()}_user`,
        type: 'user',
        content,
        timestamp: new Date(),
        isVoice: true
      };
      
      EnhancedSessionStorage.addMessage(session.id, userMessage);
      
      // Get AI response using enhanced Claude service
      const updatedSession = EnhancedSessionStorage.getSession(session.id);
      if (!updatedSession) return;
      
      // Send to Claude API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedSession.messages,
          query: content,
          isVoiceInput: true
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Add assistant message with cited articles
        const assistantMessage: Message = {
          id: `msg_${Date.now()}_assistant`,
          type: 'assistant',
          content: data.response,
          timestamp: new Date(),
          citedArticles: data.citedArticles || []
        };
        
        EnhancedSessionStorage.addMessage(session.id, assistantMessage);
        
        // Update local state
        const finalSession = EnhancedSessionStorage.getSession(session.id);
        if (finalSession) {
          setSession(finalSession);
        }
        
        // Speak the response
        setIsSpeaking(true);
        await voiceService.current.speak(data.response, 'professional');
        setIsSpeaking(false);
        
        // Auto-notes will be generated automatically by EnhancedSessionStorage
      }
      
    } catch (error) {
      console.error('Error handling user message:', error);
      setIsSpeaking(false);
    }
  }, [session]);

  const interruptSpeech = useCallback(() => {
    if (voiceService.current) {
      voiceService.current.interruptAll();
      setIsSpeaking(false);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!voiceInput.current || !session) return;
    
    setCurrentTranscript('');
    
    await voiceInput.current.startListening(
      (transcript, isFinal) => {
        setCurrentTranscript(transcript);
        
        if (isFinal && transcript.trim()) {
          handleUserMessage(transcript.trim());
        }
      },
      (error) => {
        console.error('Voice input error:', error);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );
    
    setIsListening(true);
  }, [session, handleUserMessage]);

  const stopListening = useCallback(() => {
    if (voiceInput.current) {
      voiceInput.current.stopListening();
    }
    setIsListening(false);
  }, []);

  if (!session) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex">
      {/* Left Side - Voice Interface */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-white/80 backdrop-blur-sm">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          )}
          
          <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <Settings className="w-5 h-5" />
            Voice Settings
          </button>
        </div>

        {/* Main Voice Interface */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {/* Advisor Info */}
          <div className="text-center mb-12">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center mb-6 mx-auto">
              <User className="w-12 h-12 text-white" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Sanjay Bhargava</h1>
            <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
              PayPal founding member and former SpaceX India head offering data-driven, practical financial guidance. 
              Known for achieving "Zero Financial Anxiety" through personalized strategies.
            </p>
          </div>

          {/* Voice Button */}
          <div className="mb-8">
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isSpeaking}
              className={`
                w-32 h-32 rounded-full flex items-center justify-center text-white font-bold text-lg
                transition-all duration-200 transform hover:scale-105 shadow-2xl
                ${isListening 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : isSpeaking
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-blue-500 hover:bg-blue-600'
                }
                ${isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {isListening ? (
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 bg-white rounded mb-2"></div>
                  <span className="text-sm">Listening</span>
                </div>
              ) : isSpeaking ? (
                <div className="flex flex-col items-center">
                  <Volume2 className="w-8 h-8 mb-2" />
                  <span className="text-sm">Speaking</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Volume2 className="w-8 h-8 mb-2" />
                  <span className="text-sm">Tap to Talk</span>
                </div>
              )}
            </button>
          </div>

          <p className="text-gray-600 text-center">
            {isListening
              ? "I'm listening... Speak naturally about your financial concerns."
              : isSpeaking
              ? "Sanjay is responding..."
              : hasPlayedIntro
              ? "Tap the button to continue your conversation with Sanjay"
              : "Starting your session with Sanjay..."}
          </p>

          {/* Live Transcript */}
          {currentTranscript && (
            <div className="mt-6 p-4 bg-white/70 backdrop-blur-sm rounded-xl max-w-md">
              <p className="text-gray-800 text-center italic">"{currentTranscript}"</p>
            </div>
          )}
          
          {/* Interrupt Button */}
          {isSpeaking && (
            <div className="mt-4">
              <button
                onClick={interruptSpeech}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Stop Speaking
              </button>
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
            <span>Transcript</span>
            <span className="text-sm text-gray-500">
              {session.messages.length} messages
            </span>
            {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Transcript Section */}
        {showTranscript && (
          <div className="bg-white border-t max-h-60 overflow-y-auto">
            <div className="p-4 space-y-4">
              {session.messages.map((message) => {
                const isUser = message.type === 'user' || message.sender === 'user';
                return (
                  <div
                    key={message.id}
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
                      {message.content}
                      {!isUser && message.citedArticles && message.citedArticles.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-300">
                          <p className="text-xs text-gray-500 mb-1">Referenced articles:</p>
                          {message.citedArticles.slice(0, 2).map((article) => (
                            <div key={article.id} className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer mb-1">
                              📄 {article.title}
                            </div>
                          ))}
                          {message.citedArticles.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{message.citedArticles.length - 2} more articles
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right Side - Session Info & Notes */}
      <div className="w-96 bg-white shadow-xl p-6 overflow-y-auto">
        {/* Session Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">Financial Coaching Session</h2>
          <h3 className="text-lg font-semibold text-purple-700 mb-1">Sanjay Bhargava</h3>
          <p className="text-gray-600 text-sm italic mb-4">Smart investing & wealth building</p>
          
          <div className="flex items-center gap-2 justify-center text-sm text-gray-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Coaching Approach</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Teaching-focused, patient, data-driven but accessible</p>
        </div>

        {/* Areas of Expertise */}
        <div className="mb-8">
          <h4 className="font-semibold text-gray-900 mb-3">Areas of Expertise:</h4>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <span>Value investing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <span>Stock analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <span>Wealth building</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <span>Financial education</span>
            </div>
          </div>
        </div>

        {/* Session Notes */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Session Notes</h4>
          {session.notes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Notes will appear automatically as you converse</p>
            </div>
          ) : (
            <div className="space-y-3">
              {session.notes.map((note) => (
                <div
                  key={note.id}
                  className={`p-3 rounded-lg border text-sm ${
                    note.type === 'insight' ? 'bg-yellow-50 border-yellow-200 text-yellow-900' :
                    note.type === 'action' ? 'bg-green-50 border-green-200 text-green-900' :
                    note.type === 'recommendation' ? 'bg-blue-50 border-blue-200 text-blue-900' :
                    'bg-purple-50 border-purple-200 text-purple-900'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-medium uppercase tracking-wide">
                      {note.type}
                      {note.autoGenerated && ' (Auto)'}
                    </span>
                    <span className="text-xs opacity-75">
                      {note.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="leading-relaxed">{note.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}