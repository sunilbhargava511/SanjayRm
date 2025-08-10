'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Volume2, ArrowLeft, Sparkles } from 'lucide-react';
import { Message, Session, Article } from '@/types';
import { SessionStorage } from '@/lib/sessionStorage';
import VoiceRecorder from '@/components/voice/VoiceRecorder';
import SessionNotebook from '@/components/notebook/SessionNotebook';

interface ChatInterfaceProps {
  onBack?: () => void;
}

export default function ChatInterface({ onBack }: ChatInterfaceProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [relevantArticles, setRelevantArticles] = useState<Article[]>([]);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isVoiceInput, setIsVoiceInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load existing session or create new one
    let currentSession = SessionStorage.getCurrentSession();
    if (!currentSession) {
      currentSession = SessionStorage.createNewSession();
      SessionStorage.saveSession(currentSession);
    }
    setSession(currentSession);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (messageText?: string, isVoice = false) => {
    const content = messageText || inputMessage.trim();
    if (!content || !session || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content,
      timestamp: new Date(),
      isVoice,
      rawTranscript: isVoice ? voiceTranscript : undefined
    };

    // Add user message to session
    const updatedSession = { ...session };
    updatedSession.messages.push(userMessage);
    setSession(updatedSession);
    SessionStorage.saveSession(updatedSession);

    // Clear input
    setInputMessage('');
    setVoiceTranscript('');
    setIsVoiceInput(false);
    setIsLoading(true);

    try {
      // Send to Claude API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedSession.messages.slice(0, -1), // Don't include the current message
          query: content,
          isVoiceInput: isVoice
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          id: `msg_${Date.now() + 1}`,
          type: 'assistant',
          content: data.response,
          timestamp: new Date()
        };

        // Add assistant response
        updatedSession.messages.push(assistantMessage);
        setSession(updatedSession);
        SessionStorage.saveSession(updatedSession);

        // Set relevant articles
        if (data.relevantArticles) {
          setRelevantArticles(data.relevantArticles);
        }

        // Extract and save notes
        try {
          const notesResponse = await fetch('/api/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'extractNotes',
              userMessage: content,
              assistantMessage: data.response
            }),
          });

          const notesData = await notesResponse.json();
          if (notesData.success && notesData.notes.length > 0) {
            // Add extracted notes to session
            notesData.notes.forEach((noteData: { content: string; type: 'insight' | 'action' | 'recommendation' | 'question' }) => {
              SessionStorage.addNote(updatedSession.id, {
                content: noteData.content,
                type: noteData.type,
                messageId: assistantMessage.id
              });
            });

            // Refresh session to include new notes
            const refreshedSession = SessionStorage.getSession(updatedSession.id);
            if (refreshedSession) {
              setSession(refreshedSession);
            }
          }
        } catch (error) {
          console.error('Error extracting notes:', error);
        }

      } else {
        // Handle error
        const errorMessage: Message = {
          id: `msg_${Date.now() + 1}`,
          type: 'assistant',
          content: `I apologize, but I encountered an error: ${data.error}. Please try again.`,
          timestamp: new Date()
        };

        updatedSession.messages.push(errorMessage);
        setSession(updatedSession);
        SessionStorage.saveSession(updatedSession);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        type: 'assistant',
        content: 'I apologize, but I encountered a connection error. Please check your internet connection and try again.',
        timestamp: new Date()
      };

      updatedSession.messages.push(errorMessage);
      setSession(updatedSession);
      SessionStorage.saveSession(updatedSession);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceTranscriptChange = (transcript: string) => {
    setVoiceTranscript(transcript);
    setInputMessage(transcript);
    setIsVoiceInput(true);
  };

  const handleVoiceRecordingComplete = (transcript: string) => {
    setVoiceTranscript(transcript);
    setInputMessage(transcript);
    setIsVoiceInput(true);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const generateSessionSummary = async () => {
    if (!session || session.messages.length < 2) return;

    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generateSummary',
          messages: session.messages
        }),
      });

      const data = await response.json();
      if (data.success) {
        SessionStorage.updateSessionSummary(session.id, data.summary);
        const updatedSession = SessionStorage.getSession(session.id);
        if (updatedSession) {
          setSession(updatedSession);
        }
      }
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-gray-900">Sanjay Bhargava</h1>
              <p className="text-sm text-gray-500">Financial Therapist • Voice Session Active</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600">Listening & Recording</span>
              </div>
            </div>
          </div>
          <button
            onClick={generateSessionSummary}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate Summary
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto p-4 space-y-6">
              {session.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.type === 'assistant' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-2xl ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                    }`}
                  >
                    {message.isVoice && message.rawTranscript && (
                      <div className="mb-2 pb-2 border-b border-blue-300 opacity-75">
                        <div className="flex items-center gap-1 text-xs mb-1">
                          <Volume2 className="w-3 h-3" />
                          Original transcript:
                        </div>
                        <div className="text-xs italic">{message.rawTranscript}</div>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                    <div
                      className={`text-xs mt-2 opacity-75 ${
                        message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>

                  {message.type === 'user' && (
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Relevant Articles */}
          {relevantArticles.length > 0 && (
            <div className="border-t border-gray-200 bg-white">
              <div className="max-w-3xl mx-auto p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Related Articles</h4>
                <div className="flex gap-3 overflow-x-auto">
                  {relevantArticles.map((article) => (
                    <div
                      key={article.id}
                      className="flex-shrink-0 w-64 p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <h5 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                        {article.title}
                      </h5>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                        {article.summary}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 font-medium">{article.category}</span>
                        <span className="text-xs text-gray-500">{article.readTime}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Voice-First Input Area */}
          <div className="border-t border-gray-200 bg-white">
            <div className="max-w-3xl mx-auto p-6">
              {/* Primary Voice Interface */}
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Voice Session Active</h3>
                  <p className="text-sm text-gray-600">Speak naturally - I'll transcribe and respond</p>
                </div>
                <VoiceRecorder
                  onTranscriptChange={handleVoiceTranscriptChange}
                  onRecordingComplete={handleVoiceRecordingComplete}
                  disabled={isLoading}
                />
              </div>

              {/* Live Transcript Display */}
              {voiceTranscript && (
                <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Volume2 className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">Live Transcript</span>
                  </div>
                  <p className="text-gray-800 leading-relaxed">{voiceTranscript}</p>
                </div>
              )}
              
              {/* Secondary Text Input */}
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Or type your message here..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
                />
                <button
                  onClick={() => handleSendMessage(undefined, isVoiceInput)}
                  disabled={!inputMessage.trim() || isLoading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              
              {isVoiceInput && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Volume2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Voice input processing - message will be optimized for clarity</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notebook Sidebar */}
        <div className="w-96 border-l border-gray-200 bg-gray-50 overflow-y-auto">
          <div className="p-4">
            <SessionNotebook
              session={session}
              onSessionUpdate={setSession}
            />
          </div>
        </div>
      </div>
    </div>
  );
}