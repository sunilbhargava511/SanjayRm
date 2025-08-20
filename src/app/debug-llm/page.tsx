'use client';

import React, { useState, useEffect } from 'react';
import { Bug, Download, Trash2, RefreshCw, Play, Pause } from 'lucide-react';
import DebugLLMPanel from '@/components/debug/DebugLLMPanel';
import { debugSessionManager, DebugSession } from '@/lib/debug-session-manager';
import { debugLLMService } from '@/lib/debug-llm-service';

export default function DebugLLMPage() {
  const [sessions, setSessions] = useState<DebugSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isRealTime, setIsRealTime] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [refreshKey]);

  // Real-time updates
  useEffect(() => {
    if (!isRealTime) return;

    const interval = setInterval(() => {
      loadSessions();
    }, 3000);

    return () => clearInterval(interval);
  }, [isRealTime]);

  const loadSessions = () => {
    const allSessions = debugSessionManager.getAllSessions();
    setSessions(allSessions);
    
    const current = debugSessionManager.getCurrentSession();
    setCurrentSessionId(current?.id || null);
  };

  const handleSessionSwitch = (sessionId: string) => {
    debugSessionManager.switchToSession(sessionId);
    setCurrentSessionId(sessionId);
    console.log('Switched to session:', sessionId);
  };

  const handleClearSession = (sessionId: string) => {
    if (confirm('Are you sure you want to clear this session?')) {
      debugSessionManager.clearSession(sessionId);
      loadSessions();
    }
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all debug sessions?')) {
      debugLLMService.clearDebugData();
      loadSessions();
    }
  };

  const handleExport = () => {
    if (!currentSessionId) return;
    
    try {
      const exportData = debugSessionManager.exportSession(currentSessionId);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug-session-${currentSessionId}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export session data');
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const debugStats = debugLLMService.getDebugStats();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Bug className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Debug LLM</h1>
            </div>
            
            {/* Session Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Session:</span>
              <select
                value={currentSessionId || ''}
                onChange={(e) => e.target.value && handleSessionSwitch(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select session...</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title} ({session.entries.length} entries)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Real-time toggle */}
            <button
              onClick={() => setIsRealTime(!isRealTime)}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium ${
                isRealTime
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isRealTime ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isRealTime ? 'Real-time: ON' : 'Real-time: OFF'}
            </button>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm font-medium"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={!currentSessionId}
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Download className="w-3 h-3" />
              Export
            </button>

            {/* Clear All */}
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm font-medium"
            >
              <Trash2 className="w-3 h-3" />
              Clear All
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
          <span>Debug Status: {debugStats.isEnabled ? '✅ Enabled' : '❌ Disabled'}</span>
          <span>Total Sessions: {debugStats.totalSessions}</span>
          <span>Current Session Entries: {debugStats.currentSessionEntries}</span>
          {currentSession && (
            <>
              <span>•</span>
              <span>Started: {currentSession.startTime.toLocaleTimeString()}</span>
              {currentSession.endTime && (
                <span>Ended: {currentSession.endTime.toLocaleTimeString()}</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Debug Panel */}
      {currentSessionId && currentSession ? (
        <DebugLLMPanel
          session={currentSession}
          onClearSession={() => handleClearSession(currentSession.id)}
          isRealTime={isRealTime}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Bug className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Session Selected</h3>
          <p className="text-gray-600 mb-4">
            {sessions.length === 0
              ? 'No debug sessions available. Start a conversation to create a debug session.'
              : 'Select a session from the dropdown above to view debug information.'}
          </p>
          {sessions.length === 0 && (
            <div className="text-sm text-gray-500">
              Debug sessions are created automatically when you start conversations with the AI.
            </div>
          )}
        </div>
      )}
    </div>
  );
}