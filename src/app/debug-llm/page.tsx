'use client';

import React, { useState, useEffect } from 'react';
import { Bug, Download, Trash2, RefreshCw, Play, Pause } from 'lucide-react';
import DebugLLMPanel from '@/components/debug/DebugLLMPanel';
import { LLMDebugEntry } from '@/lib/debug-session-manager';

interface DebugStats {
  isEnabled: boolean;
  currentSessionId: string | null;
  totalSessions: number;
  currentSessionEntries: number;
}

export default function DebugLLMPage() {
  const [entries, setEntries] = useState<LLMDebugEntry[]>([]);
  const [debugStats, setDebugStats] = useState<DebugStats | null>(null);
  const [isRealTime, setIsRealTime] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load debug data on mount
  useEffect(() => {
    loadDebugData();
  }, [refreshKey]);

  // Real-time updates
  useEffect(() => {
    if (!isRealTime) return;

    const interval = setInterval(() => {
      loadDebugData();
    }, 3000);

    return () => clearInterval(interval);
  }, [isRealTime]);

  const loadDebugData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch debug stats and entries
      const [statsResponse, entriesResponse] = await Promise.all([
        fetch('/api/debug-llm?action=stats'),
        fetch('/api/debug-llm?action=current-session')
      ]);

      if (!statsResponse.ok || !entriesResponse.ok) {
        throw new Error('Failed to fetch debug data');
      }

      const statsData = await statsResponse.json();
      const entriesData = await entriesResponse.json();

      if (statsData.success) {
        setDebugStats(statsData.stats);
      }

      if (entriesData.success) {
        setEntries(entriesData.entries || []);
      }
    } catch (err) {
      console.error('Error loading debug data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load debug data');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear all debug data?')) {
      try {
        const response = await fetch('/api/debug-llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear' })
        });

        if (response.ok) {
          await loadDebugData();
        } else {
          throw new Error('Failed to clear debug data');
        }
      } catch (err) {
        console.error('Error clearing debug data:', err);
        setError('Failed to clear debug data');
      }
    }
  };

  const handleExport = () => {
    if (!entries.length) return;
    
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        debugStats,
        entries
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug-llm-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export debug data');
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading debug data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Bug className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Debug Data</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
            
            {/* Debug Status */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Status: {debugStats?.isEnabled ? '✅ Enabled' : '❌ Disabled'}
              </span>
              <span className="text-sm text-gray-600">
                Entries: {entries.length}
              </span>
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
              disabled={!entries.length}
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
          <span>Debug Status: {debugStats?.isEnabled ? '✅ Enabled' : '❌ Disabled'}</span>
          <span>Total Sessions: {debugStats?.totalSessions || 0}</span>
          <span>Current Session Entries: {debugStats?.currentSessionEntries || 0}</span>
          {debugStats?.currentSessionId && (
            <>
              <span>•</span>
              <span>Session ID: {debugStats.currentSessionId}</span>
            </>
          )}
        </div>
      </div>

      {/* Debug Panel */}
      {entries.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">LLM Debug Entries</h3>
          <div className="space-y-4">
            {entries.map((entry, index) => (
              <div key={entry.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      entry.status === 'success' ? 'bg-green-100 text-green-800' :
                      entry.status === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {entry.status}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{entry.type}</span>
                    <span className="text-sm text-gray-500">{entry.request.model}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Request</h4>
                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                      <div><strong>System:</strong> {entry.request.systemPrompt.substring(0, 100)}...</div>
                      {entry.request.messages.length > 0 && (
                        <div><strong>Messages:</strong> {entry.request.messages.length} messages</div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Response</h4>
                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                      {entry.status === 'success' ? (
                        <div>{entry.response.content.substring(0, 150)}...</div>
                      ) : entry.error ? (
                        <div className="text-red-600">{entry.error}</div>
                      ) : (
                        <div className="text-yellow-600">Pending...</div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {entry.response.processingTime}ms
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Bug className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Debug Data Available</h3>
          <p className="text-gray-600 mb-4">
            {debugStats?.isEnabled
              ? 'Debug capture is enabled. LLM interactions will appear here when they occur.'
              : 'Debug capture is disabled. Enable it in the admin panel to see LLM interactions.'}
          </p>
          <div className="text-sm text-gray-500">
            Try making some API calls to /api/chat/completions to generate debug data.
          </div>
        </div>
      )}
    </div>
  );
}