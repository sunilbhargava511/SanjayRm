import { db } from './database';
import * as schema from './database/schema';
import { eq, desc, and, asc } from 'drizzle-orm';
import { adminService } from './admin-service';
import { Message, Article } from '@/types';

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

export interface DatabaseDebugEntry {
  id: string;
  sessionId: string;
  timestamp: Date;
  type: 'claude' | 'knowledge-search' | 'rag';
  status: 'pending' | 'success' | 'error';
  request: LLMRequestData;
  response: {
    content: string;
    processingTime: number;
    usage?: { tokens: number };
    citedArticles?: Article[];
  };
  error?: string;
}

export class DebugDatabaseService {
  private static instance: DebugDatabaseService;
  private isEnabled: boolean = false;
  private enabledCache: boolean | null = null;
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds cache
  private currentSessionId: string | null = null;

  private constructor() {
    // Initialize and load settings from database
    this.loadDebugSettings();
  }

  static getInstance(): DebugDatabaseService {
    if (!DebugDatabaseService.instance) {
      DebugDatabaseService.instance = new DebugDatabaseService();
    }
    return DebugDatabaseService.instance;
  }

  // Load debug settings from database
  private async loadDebugSettings(): Promise<void> {
    try {
      const settings = await adminService.getAdminSettings();
      const newIsEnabled = settings?.debugLlmEnabled || false;
      
      if (this.isEnabled !== newIsEnabled) {
        this.isEnabled = newIsEnabled;
        console.log(`[Debug DB] Service ${newIsEnabled ? 'enabled' : 'disabled'} via database setting`);
      }
      
      // Update cache
      this.enabledCache = newIsEnabled;
      this.lastCacheUpdate = Date.now();
    } catch (error) {
      console.error('[Debug DB] Failed to load settings from database:', error);
      // Fall back to development mode
      this.isEnabled = process.env.NODE_ENV === 'development';
    }
  }

  // Check if debug capture is enabled (with caching)
  async isDebugEnabled(): Promise<boolean> {
    const now = Date.now();
    
    // Use cached value if fresh
    if (this.enabledCache !== null && (now - this.lastCacheUpdate) < this.CACHE_TTL) {
      return this.enabledCache;
    }
    
    // Reload from database
    await this.loadDebugSettings();
    return this.isEnabled;
  }

  // Synchronous version (uses cached value)
  isDebugEnabledSync(): boolean {
    return this.isEnabled;
  }

  // Enable/disable debug capture
  setDebugEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`[Debug DB] Service ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Get or create current debug session
  private async getCurrentSession(): Promise<string> {
    if (this.currentSessionId) {
      return this.currentSessionId;
    }

    try {
      // Check for existing active session
      const activeSessions = await db
        .select()
        .from(schema.debugSessions)
        .where(eq(schema.debugSessions.isActive, true))
        .orderBy(desc(schema.debugSessions.startTime))
        .limit(1);

      if (activeSessions.length > 0) {
        this.currentSessionId = activeSessions[0].id;
        return this.currentSessionId;
      }

      // Create new session
      const sessionId = `debug_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await db.insert(schema.debugSessions).values({
        id: sessionId,
        title: `Debug Session ${new Date().toLocaleString()}`,
        isActive: true
      });

      this.currentSessionId = sessionId;
      console.log(`[Debug DB] Created new debug session: ${sessionId}`);
      
      return sessionId;
    } catch (error) {
      console.error('[Debug DB] Failed to get/create session:', error);
      // Fallback session ID
      const fallbackId = `fallback_${Date.now()}`;
      this.currentSessionId = fallbackId;
      return fallbackId;
    }
  }

  // Start tracking an LLM request
  async startRequest(
    type: 'claude' | 'knowledge-search' | 'rag',
    requestData: LLMRequestData
  ): Promise<string> {
    if (!this.isDebugEnabledSync()) return '';

    try {
      const sessionId = await this.getCurrentSession();
      const entryId = `debug_entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await db.insert(schema.debugEntries).values({
        id: entryId,
        sessionId,
        type,
        status: 'pending',
        requestModel: requestData.model,
        requestSystemPrompt: requestData.systemPrompt,
        requestMessages: JSON.stringify(requestData.messages),
        requestTemperature: requestData.temperature,
        requestMaxTokens: requestData.maxTokens,
        requestKnowledgeContext: requestData.knowledgeContext,
        requestOtherParams: requestData.otherParameters ? JSON.stringify(requestData.otherParameters) : null,
        responseProcessingTime: 0
      });
      
      console.log(`[Debug DB] Started tracking ${type} request: ${entryId}`);
      return entryId;
    } catch (error) {
      console.error('[Debug DB] Failed to start request tracking:', error);
      return '';
    }
  }

  // Complete tracking an LLM request with success
  async completeRequest(
    entryId: string,
    responseData: LLMResponseData
  ): Promise<void> {
    if (!this.isDebugEnabledSync() || !entryId) return;

    try {
      await db
        .update(schema.debugEntries)
        .set({
          status: 'success',
          responseContent: responseData.content,
          responseProcessingTime: responseData.processingTime,
          responseTokens: responseData.usage?.tokens,
          responseCitedArticles: responseData.citedArticles ? JSON.stringify(responseData.citedArticles) : null
        })
        .where(eq(schema.debugEntries.id, entryId));
      
      console.log(`[Debug DB] Completed request: ${entryId} (${responseData.processingTime}ms)`);
    } catch (error) {
      console.error('[Debug DB] Failed to complete request:', error);
    }
  }

  // Mark request as failed
  async failRequest(
    entryId: string,
    error: string,
    processingTime: number = 0
  ): Promise<void> {
    if (!this.isDebugEnabledSync() || !entryId) return;

    try {
      await db
        .update(schema.debugEntries)
        .set({
          status: 'error',
          errorMessage: error,
          responseProcessingTime: processingTime
        })
        .where(eq(schema.debugEntries.id, entryId));
      
      console.log(`[Debug DB] Failed request: ${entryId} - ${error}`);
    } catch (error) {
      console.error('[Debug DB] Failed to mark request as failed:', error);
    }
  }

  // Get recent debug entries
  async getRecentEntries(limit: number = 20): Promise<DatabaseDebugEntry[]> {
    try {
      const entries = await db
        .select()
        .from(schema.debugEntries)
        .orderBy(desc(schema.debugEntries.timestamp))
        .limit(limit);

      return entries.map(this.convertDatabaseEntry);
    } catch (error) {
      console.error('[Debug DB] Failed to get recent entries:', error);
      return [];
    }
  }

  // Get entries for current session
  async getCurrentSessionEntries(): Promise<DatabaseDebugEntry[]> {
    if (!this.currentSessionId) {
      await this.getCurrentSession();
    }
    
    if (!this.currentSessionId) return [];

    try {
      const entries = await db
        .select()
        .from(schema.debugEntries)
        .where(eq(schema.debugEntries.sessionId, this.currentSessionId))
        .orderBy(desc(schema.debugEntries.timestamp));

      return entries.map(this.convertDatabaseEntry);
    } catch (error) {
      console.error('[Debug DB] Failed to get current session entries:', error);
      return [];
    }
  }

  // Get all debug sessions
  async getAllSessions(): Promise<Array<{ id: string; title: string; entryCount: number; startTime: Date; isActive: boolean }>> {
    try {
      const sessions = await db
        .select()
        .from(schema.debugSessions)
        .orderBy(desc(schema.debugSessions.startTime));

      const sessionsWithCounts = await Promise.all(
        sessions.map(async (session) => {
          const entryCount = await db
            .select({ count: sql`count(*)` })
            .from(schema.debugEntries)
            .where(eq(schema.debugEntries.sessionId, session.id));

          return {
            id: session.id,
            title: session.title,
            entryCount: Number(entryCount[0]?.count || 0),
            startTime: new Date(session.startTime),
            isActive: Boolean(session.isActive)
          };
        })
      );

      return sessionsWithCounts;
    } catch (error) {
      console.error('[Debug DB] Failed to get all sessions:', error);
      return [];
    }
  }

  // Get debug statistics
  async getDebugStats(): Promise<{
    isEnabled: boolean;
    currentSessionId: string | null;
    totalSessions: number;
    currentSessionEntries: number;
    totalEntries: number;
  }> {
    try {
      const [sessionCount, entryCount] = await Promise.all([
        db.select({ count: sql`count(*)` }).from(schema.debugSessions),
        db.select({ count: sql`count(*)` }).from(schema.debugEntries)
      ]);

      let currentSessionEntries = 0;
      if (this.currentSessionId) {
        const currentCount = await db
          .select({ count: sql`count(*)` })
          .from(schema.debugEntries)
          .where(eq(schema.debugEntries.sessionId, this.currentSessionId));
        currentSessionEntries = Number(currentCount[0]?.count || 0);
      }

      return {
        isEnabled: this.isDebugEnabledSync(),
        currentSessionId: this.currentSessionId,
        totalSessions: Number(sessionCount[0]?.count || 0),
        currentSessionEntries,
        totalEntries: Number(entryCount[0]?.count || 0)
      };
    } catch (error) {
      console.error('[Debug DB] Failed to get debug stats:', error);
      return {
        isEnabled: this.isDebugEnabledSync(),
        currentSessionId: null,
        totalSessions: 0,
        currentSessionEntries: 0,
        totalEntries: 0
      };
    }
  }

  // Clear debug data (with size limits)
  async clearDebugData(): Promise<void> {
    try {
      await db.delete(schema.debugEntries);
      await db.delete(schema.debugSessions);
      this.currentSessionId = null;
      console.log('[Debug DB] Cleared all debug data');
    } catch (error) {
      console.error('[Debug DB] Failed to clear debug data:', error);
    }
  }

  // Cleanup old entries (keep last N entries)
  async cleanupOldEntries(keepLastN: number = 1000): Promise<number> {
    try {
      // Get the Nth most recent entry timestamp
      const cutoffEntries = await db
        .select({ timestamp: schema.debugEntries.timestamp })
        .from(schema.debugEntries)
        .orderBy(desc(schema.debugEntries.timestamp))
        .limit(1)
        .offset(keepLastN - 1);

      if (cutoffEntries.length === 0) return 0;

      const cutoffTimestamp = cutoffEntries[0].timestamp;

      // Delete entries older than the cutoff
      const deletedEntries = await db
        .delete(schema.debugEntries)
        .where(sql`${schema.debugEntries.timestamp} < ${cutoffTimestamp}`);

      // Delete empty sessions (simplified approach)
      const allSessions = await db.select({ id: schema.debugSessions.id }).from(schema.debugSessions);
      
      for (const session of allSessions) {
        const entryCount = await db
          .select({ count: sql`count(*)` })
          .from(schema.debugEntries)
          .where(eq(schema.debugEntries.sessionId, session.id));
        
        if (Number(entryCount[0]?.count || 0) === 0) {
          await db.delete(schema.debugSessions).where(eq(schema.debugSessions.id, session.id));
        }
      }

      console.log(`[Debug DB] Cleaned up old entries, kept last ${keepLastN}`);
      return deletedEntries.changes || 0;
    } catch (error) {
      console.error('[Debug DB] Failed to cleanup old entries:', error);
      return 0;
    }
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
  ): Promise<string> {
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
  async captureKnowledgeSearch(
    searchQuery: string,
    foundArticles: Article[],
    processingTime: number
  ): Promise<void> {
    if (!this.isDebugEnabledSync()) return;

    const entryId = await this.startRequest('knowledge-search', {
      systemPrompt: `Knowledge search for: "${searchQuery}"`,
      messages: [],
      model: 'knowledge-base-search',
      knowledgeContext: `Found ${foundArticles.length} articles`
    });

    await this.completeRequest(entryId, {
      content: `Found ${foundArticles.length} relevant articles`,
      citedArticles: foundArticles,
      processingTime
    });
  }

  // Convert database entry to our format
  private convertDatabaseEntry(dbEntry: any): DatabaseDebugEntry {
    return {
      id: dbEntry.id,
      sessionId: dbEntry.sessionId,
      timestamp: new Date(dbEntry.timestamp),
      type: dbEntry.type,
      status: dbEntry.status,
      request: {
        systemPrompt: dbEntry.requestSystemPrompt || '',
        messages: dbEntry.requestMessages ? JSON.parse(dbEntry.requestMessages) : [],
        temperature: dbEntry.requestTemperature,
        maxTokens: dbEntry.requestMaxTokens,
        model: dbEntry.requestModel,
        knowledgeContext: dbEntry.requestKnowledgeContext,
        otherParameters: dbEntry.requestOtherParams ? JSON.parse(dbEntry.requestOtherParams) : undefined
      },
      response: {
        content: dbEntry.responseContent || '',
        processingTime: dbEntry.responseProcessingTime || 0,
        usage: dbEntry.responseTokens ? { tokens: dbEntry.responseTokens } : undefined,
        citedArticles: dbEntry.responseCitedArticles ? JSON.parse(dbEntry.responseCitedArticles) : undefined
      },
      error: dbEntry.errorMessage
    };
  }
}

// Import required SQL functions
import { sql } from 'drizzle-orm';

// Singleton instance for server-side use
export const debugDatabaseService = DebugDatabaseService.getInstance();