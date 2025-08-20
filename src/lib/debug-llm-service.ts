import { Message, Article } from '@/types';
import { debugSessionManager, LLMDebugEntry } from './debug-session-manager';

interface LLMRequestData {
  systemPrompt: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  model: string;
  knowledgeContext?: string;
  otherParameters?: Record<string, any>;
}

interface LLMResponseData {
  content: string;
  usage?: { tokens: number };
  citedArticles?: Article[];
  processingTime: number;
}

export class DebugLLMService {
  private static instance: DebugLLMService;
  private isEnabled: boolean = true;

  private constructor() {
    // Enable debug capture in development or when explicitly enabled
    this.isEnabled = process.env.NODE_ENV === 'development' || 
                     process.env.NEXT_PUBLIC_ENABLE_LLM_DEBUG === 'true';
    
    if (this.isEnabled) {
      console.log('[Debug LLM] Service initialized');
    }
  }

  static getInstance(): DebugLLMService {
    if (!DebugLLMService.instance) {
      DebugLLMService.instance = new DebugLLMService();
    }
    return DebugLLMService.instance;
  }

  // Check if debug capture is enabled
  isDebugEnabled(): boolean {
    return this.isEnabled;
  }

  // Enable/disable debug capture
  setDebugEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`[Debug LLM] Service ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Start tracking an LLM request
  startRequest(
    type: 'claude' | 'knowledge-search' | 'rag',
    requestData: LLMRequestData
  ): string {
    if (!this.isEnabled) return '';

    const entryId = `debug_entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const debugEntry: LLMDebugEntry = {
      id: entryId,
      timestamp: new Date(),
      sessionId: '', // Will be set by session manager
      type,
      request: { ...requestData },
      response: {
        content: '',
        processingTime: 0
      },
      status: 'pending'
    };

    // Add to current session
    debugSessionManager.addEntryToCurrentSession(debugEntry);
    
    console.log(`[Debug LLM] Started tracking ${type} request: ${entryId}`);
    return entryId;
  }

  // Complete tracking an LLM request with success
  completeRequest(
    entryId: string,
    responseData: LLMResponseData
  ): void {
    if (!this.isEnabled || !entryId) return;

    const currentSession = debugSessionManager.getCurrentSession();
    if (!currentSession) return;

    const entry = currentSession.entries.find(e => e.id === entryId);
    if (!entry) {
      console.warn(`[Debug LLM] Entry not found: ${entryId}`);
      return;
    }

    // Update entry with response data
    entry.response = { ...responseData };
    entry.status = 'success';
    
    console.log(`[Debug LLM] Completed request: ${entryId} (${responseData.processingTime}ms)`);
  }

  // Mark request as failed
  failRequest(
    entryId: string,
    error: string,
    processingTime: number = 0
  ): void {
    if (!this.isEnabled || !entryId) return;

    const currentSession = debugSessionManager.getCurrentSession();
    if (!currentSession) return;

    const entry = currentSession.entries.find(e => e.id === entryId);
    if (!entry) {
      console.warn(`[Debug LLM] Entry not found: ${entryId}`);
      return;
    }

    // Update entry with error
    entry.response.processingTime = processingTime;
    entry.status = 'error';
    entry.error = error;
    
    console.log(`[Debug LLM] Failed request: ${entryId} - ${error}`);
  }

  // Get recent debug entries (for real-time display)
  getRecentEntries(limit: number = 20): LLMDebugEntry[] {
    const currentSession = debugSessionManager.getCurrentSession();
    if (!currentSession) return [];

    return currentSession.entries
      .slice(-limit)
      .reverse(); // Most recent first
  }

  // Get all entries for current session
  getCurrentSessionEntries(): LLMDebugEntry[] {
    const currentSession = debugSessionManager.getCurrentSession();
    if (!currentSession) return [];

    return [...currentSession.entries].reverse(); // Most recent first
  }

  // Helper method to capture Claude API calls
  captureClaudeRequest(
    messages: Message[],
    systemPrompt: string,
    model: string = 'claude-3-5-sonnet-20241022',
    temperature?: number,
    maxTokens?: number,
    knowledgeContext?: string,
    otherParameters?: Record<string, any>
  ): string {
    const type = knowledgeContext ? 'rag' : 'claude';
    
    return this.startRequest(type, {
      systemPrompt,
      messages,
      temperature,
      maxTokens,
      model,
      knowledgeContext,
      otherParameters
    });
  }

  // Helper method to capture knowledge search
  captureKnowledgeSearch(
    searchQuery: string,
    foundArticles: Article[],
    processingTime: number
  ): void {
    if (!this.isEnabled) return;

    const entryId = this.startRequest('knowledge-search', {
      systemPrompt: `Knowledge search for: "${searchQuery}"`,
      messages: [],
      model: 'knowledge-base-search',
      knowledgeContext: `Found ${foundArticles.length} articles`
    });

    this.completeRequest(entryId, {
      content: `Found ${foundArticles.length} relevant articles`,
      citedArticles: foundArticles,
      processingTime
    });
  }

  // Get debug statistics
  getDebugStats(): {
    isEnabled: boolean;
    currentSessionId: string | null;
    totalSessions: number;
    currentSessionEntries: number;
  } {
    const currentSession = debugSessionManager.getCurrentSession();
    return {
      isEnabled: this.isEnabled,
      currentSessionId: currentSession?.id || null,
      totalSessions: debugSessionManager.getAllSessions().length,
      currentSessionEntries: currentSession?.entries.length || 0
    };
  }

  // Format session transcript for display (last 200 words)
  formatSessionTranscript(messages: Message[], showFullTranscript: boolean = false): {
    summary: string;
    keyEvents: string[];
    lastWords: string;
    fullTranscript?: string;
  } {
    if (messages.length === 0) {
      return {
        summary: 'No messages in conversation',
        keyEvents: [],
        lastWords: ''
      };
    }

    // Generate key events
    const keyEvents: string[] = [];
    if (messages.length > 0) {
      keyEvents.push(`Conversation started (${messages.length} messages)`);
    }
    
    const userMessages = messages.filter(m => m.sender === 'user');
    const assistantMessages = messages.filter(m => m.sender === 'assistant');
    
    if (userMessages.length > 0) {
      keyEvents.push(`User messages: ${userMessages.length}`);
    }
    if (assistantMessages.length > 0) {
      keyEvents.push(`Assistant responses: ${assistantMessages.length}`);
    }

    // Get last 200 words
    const allText = messages.map(m => m.content).join(' ');
    const words = allText.split(/\s+/);
    const lastWords = words.slice(-200).join(' ');

    const result: {
      summary: string;
      keyEvents: string[];
      lastWords: string;
      fullTranscript?: string;
    } = {
      summary: `${messages.length} messages exchanged`,
      keyEvents,
      lastWords: words.length > 200 ? '...' + lastWords : lastWords
    };

    // Add full transcript if requested
    if (showFullTranscript) {
      result.fullTranscript = messages.map(m => 
        `[${m.timestamp?.toLocaleTimeString() || 'unknown'}] ${m.sender}: ${m.content}`
      ).join('\n');
    }

    return result;
  }

  // Clear debug data
  clearDebugData(): void {
    debugSessionManager.clearAllSessions();
    console.log('[Debug LLM] Cleared all debug data');
  }
}

// Singleton instance
export const debugLLMService = DebugLLMService.getInstance();