'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { VoiceInputService } from '@/lib/voice-services';

interface VoiceRecorderProps {
  onTranscriptChange: (transcript: string) => void;
  onRecordingComplete: (transcript: string) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ 
  onTranscriptChange, 
  onRecordingComplete,
  disabled = false 
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const voiceInputRef = useRef<VoiceInputService | null>(null);

  useEffect(() => {
    // Initialize voice input service
    const voiceInput = new VoiceInputService({
      language: 'en-US',
      continuous: true,
      interimResults: true
    });

    voiceInputRef.current = voiceInput;
    setIsSupported(voiceInput.isSupported());

    return () => {
      if (voiceInput.isCurrentlyListening()) {
        voiceInput.stopListening();
      }
    };
  }, []);

  useEffect(() => {
    // Reset transcript when recording starts
    if (isRecording) {
      setTranscript('');
      setError(null);
    }
  }, [isRecording]);

  const handleStartRecording = async () => {
    if (!voiceInputRef.current || disabled) return;
    
    setError(null);
    setTranscript('');
    
    await voiceInputRef.current.startListening(
      (newTranscript, isFinal) => {
        setTranscript(newTranscript);
        onTranscriptChange(newTranscript);
        
        if (isFinal && newTranscript.trim()) {
          onRecordingComplete(newTranscript.trim());
        }
      },
      (errorMessage) => {
        setError(errorMessage);
        setIsRecording(false);
      },
      () => {
        setIsRecording(false);
      }
    );
    
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    if (!voiceInputRef.current) return;
    
    voiceInputRef.current.stopListening();
  };

  const toggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <MicOff className="w-4 h-4" />
        <span>Voice input not supported in this browser</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggleRecording}
        disabled={disabled}
        className={`
          relative flex items-center justify-center w-12 h-12 rounded-full border-2 
          transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${isRecording 
            ? 'bg-red-500 border-red-600 text-white hover:bg-red-600' 
            : 'bg-white border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        title={isRecording ? 'Stop recording' : 'Start voice recording'}
      >
        {isRecording ? (
          <Square className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
        
        {isRecording && (
          <div className="absolute inset-0 rounded-full border-2 border-red-300 animate-ping"></div>
        )}
      </button>

      <div className="flex-1 min-w-0">
        {isRecording && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="flex gap-1">
              <div className="w-1 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <div className="w-1 h-3 bg-red-500 rounded-full animate-pulse [animation-delay:0.2s]"></div>
              <div className="w-1 h-3 bg-red-500 rounded-full animate-pulse [animation-delay:0.4s]"></div>
            </div>
            <span>Listening...</span>
          </div>
        )}
        
        {transcript && !isRecording && (
          <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2 max-h-20 overflow-y-auto">
            <span className="text-xs text-gray-500 block mb-1">Last recording:</span>
            {transcript}
          </div>
        )}
        
        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}