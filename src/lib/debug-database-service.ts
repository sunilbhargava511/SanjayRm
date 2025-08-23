import { db } from './database';
import * as schema from './database/schema';
import { eq, desc, and, asc, gt, sql } from 'drizzle-orm';
import { adminService } from './admin-service';
import { Message, Article, SessionEvent } from '@/types';

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

  // Get recent debug entries with optional time filter
  async getRecentEntries(limit: number = 20, since?: string): Promise<DatabaseDebugEntry[]> {
    try {
      const baseQuery = db
        .select()
        .from(schema.debugEntries);
      
      // Apply time filter if provided
      const query = since 
        ? baseQuery.where(gt(schema.debugEntries.timestamp, since))
        : baseQuery;
      
      const entries = await query
        .orderBy(desc(schema.debugEntries.timestamp))
        .limit(limit);

      return entries.map((entry) => this.convertDatabaseEntry(entry));
    } catch (error) {
      console.error('[Debug DB] Failed to get recent entries:', error);
      return [];
    }
  }

  // Get entries for current session with optional time filter
  async getCurrentSessionEntries(since?: string): Promise<DatabaseDebugEntry[]> {
    if (!this.currentSessionId) {
      await this.getCurrentSession();
    }
    
    if (!this.currentSessionId) return [];

    try {
      const sessionCondition = eq(schema.debugEntries.sessionId, this.currentSessionId);
      
      // Build conditions based on whether time filter is provided
      const conditions = since 
        ? and(
            sessionCondition,
            gt(schema.debugEntries.timestamp, since)
          )
        : sessionCondition;
      
      const entries = await db
        .select()
        .from(schema.debugEntries)
        .where(conditions)
        .orderBy(desc(schema.debugEntries.timestamp));

      return entries.map((entry) => this.convertDatabaseEntry(entry));
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

  // Session Event Management
  async addSessionEvent(event: SessionEvent): Promise<void> {
    if (!this.isDebugEnabledSync()) return;

    try {
      const debugSessionId = await this.getCurrentSession();
      
      await db.insert(schema.sessionEvents).values({
        id: event.id,
        sessionId: event.metadata.sessionId,
        debugSessionId,
        eventType: event.type,
        title: event.title,
        summary: event.summary,
        firstMessage: event.firstMessage,
        status: event.status,
        icon: event.icon,
        metadata: JSON.stringify(event.metadata),
        timestamp: event.timestamp.toISOString()
      });
      
      console.log(`[Debug DB] Added session event: ${event.type} (${event.id})`);
    } catch (error) {
      console.error('[Debug DB] Failed to add session event:', error);
    }
  }

  // Get session events for current debug session
  async getSessionEvents(since?: string): Promise<SessionEvent[]> {
    try {
      const debugSessionId = this.currentSessionId;
      if (!debugSessionId) return [];

      let conditions = eq(schema.sessionEvents.debugSessionId, debugSessionId);
      
      // Apply time filter if provided
      if (since) {
        conditions = and(
          eq(schema.sessionEvents.debugSessionId, debugSessionId),
          gt(schema.sessionEvents.timestamp, since)
        ) as any;
      }

      const query = db
        .select()
        .from(schema.sessionEvents)
        .where(conditions);

      const events = await query.orderBy(desc(schema.sessionEvents.timestamp));

      return events.map((event) => this.convertDatabaseSessionEvent(event));
    } catch (error) {
      console.error('[Debug DB] Failed to get session events:', error);
      return [];
    }
  }

  // Get all session events
  async getAllSessionEvents(limit: number = 50, since?: string): Promise<SessionEvent[]> {
    try {
      const baseQuery = db
        .select()
        .from(schema.sessionEvents);

      // Apply time filter if provided
      const query = since 
        ? baseQuery.where(gt(schema.sessionEvents.timestamp, since))
        : baseQuery;

      const events = await query
        .orderBy(desc(schema.sessionEvents.timestamp))
        .limit(limit);

      return events.map((event) => this.convertDatabaseSessionEvent(event));
    } catch (error) {
      console.error('[Debug DB] Failed to get all session events:', error);
      return [];
    }
  }

  // Update session event status
  async updateSessionEventStatus(eventId: string, status: 'active' | 'completed' | 'interrupted'): Promise<void> {
    if (!this.isDebugEnabledSync()) return;

    try {
      await db
        .update(schema.sessionEvents)
        .set({ 
          status,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(schema.sessionEvents.id, eventId));
      
      console.log(`[Debug DB] Updated session event ${eventId} status to ${status}`);
    } catch (error) {
      console.error('[Debug DB] Failed to update session event status:', error);
    }
  }

  // Convert database session event to our format
  private convertDatabaseSessionEvent(dbEvent: any): SessionEvent {
    return {
      id: dbEvent.id,
      type: dbEvent.eventType,
      title: dbEvent.title,
      summary: dbEvent.summary,
      timestamp: new Date(dbEvent.timestamp),
      metadata: dbEvent.metadata ? JSON.parse(dbEvent.metadata) : {},
      firstMessage: dbEvent.firstMessage,
      status: dbEvent.status,
      icon: dbEvent.icon
    };
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
        messages: this.safeJsonParse(dbEntry.requestMessages) || [],
        temperature: dbEntry.requestTemperature,
        maxTokens: dbEntry.requestMaxTokens,
        model: dbEntry.requestModel,
        knowledgeContext: dbEntry.requestKnowledgeContext,
        otherParameters: this.safeJsonParse(dbEntry.requestOtherParams)
      },
      response: {
        content: dbEntry.responseContent || '',
        processingTime: dbEntry.responseProcessingTime || 0,
        usage: dbEntry.responseTokens ? { tokens: dbEntry.responseTokens } : undefined,
        citedArticles: this.safeJsonParse(dbEntry.responseCitedArticles)
      },
      error: dbEntry.errorMessage
    };
  }

  // Safe JSON parsing with error handling and data sanitization
  private safeJsonParse(jsonString: string | null | undefined): any {
    if (!jsonString) return undefined;
    
    try {
      const parsed = JSON.parse(jsonString);
      
      // If it's an array of articles, sanitize each article
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title !== undefined) {
        return parsed.map(article => this.sanitizeArticle(article));
      }
      
      return parsed;
    } catch (error) {
      console.error('[Debug DB] Failed to parse JSON:', error);
      console.error('[Debug DB] Problematic JSON string:', jsonString?.substring(0, 200));
      
      // Try to extract readable information from corrupted JSON
      if (jsonString.includes('"title"') && jsonString.includes('"content"')) {
        return this.extractArticlesFromCorruptedJson(jsonString);
      }
      
      return undefined;
    }
  }

  // Sanitize article data to prevent display issues
  private sanitizeArticle(article: any): any {
    if (!article || typeof article !== 'object') return article;
    
    return {
      id: this.sanitizeString(article.id) || 'unknown-id',
      title: this.sanitizeString(article.title) || 'Untitled Article',
      summary: this.sanitizeString(article.summary) || '',
      content: this.sanitizeString(article.content) || '',
      category: this.sanitizeString(article.category) || 'General',
      tags: Array.isArray(article.tags) ? article.tags.map((tag: any) => this.sanitizeString(tag)).filter(Boolean) : [],
      readTime: this.sanitizeString(article.readTime) || '5 min read',
      author: this.sanitizeString(article.author) || 'Unknown',
      lastUpdated: article.lastUpdated || new Date().toISOString()
    };
  }

  // Sanitize string data to remove null bytes and control characters
  private sanitizeString(str: any): string {
    if (typeof str !== 'string') return String(str || '');
    
    return str
      .replace(/\0/g, '') // Remove null bytes
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .replace(/�/g, '') // Remove replacement characters
      .trim();
  }

  // Attempt to extract readable articles from corrupted JSON
  private extractArticlesFromCorruptedJson(jsonString: string): any[] {
    try {
      // Try to find title and content patterns
      const titleMatches = jsonString.match(/"title":\s*"([^"]+)"/g);
      const contentMatches = jsonString.match(/"content":\s*"([^"]+)"/g);
      
      if (titleMatches && contentMatches) {
        const articles = [];
        for (let i = 0; i < Math.min(titleMatches.length, contentMatches.length); i++) {
          const title = titleMatches[i].match(/"title":\s*"([^"]+)"/)?.[1] || 'Corrupted Article';
          const content = contentMatches[i].match(/"content":\s*"([^"]+)"/)?.[1] || 'Content unavailable due to data corruption';
          
          articles.push({
            id: `recovered-${i}`,
            title: this.sanitizeString(title),
            summary: 'Recovered from corrupted data',
            content: this.sanitizeString(content),
            category: 'General',
            tags: [],
            readTime: '5 min read',
            author: 'Unknown',
            lastUpdated: new Date().toISOString()
          });
        }
        return articles;
      }
    } catch (error) {
      console.error('[Debug DB] Failed to extract from corrupted JSON:', error);
    }
    
    return [];
  }
}

// Singleton instance for server-side use
export const debugDatabaseService = DebugDatabaseService.getInstance();