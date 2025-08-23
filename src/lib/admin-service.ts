import { db } from './database';
import * as schema from './database/schema';
import { eq, asc, desc } from 'drizzle-orm';
import { 
  AdminSettings, 
  SystemPrompt, 
  KnowledgeBaseFile,
  SessionReport 
} from '@/types';

export class AdminService {

  // Admin Settings Management
  async getAdminSettings(): Promise<AdminSettings | null> {
    const settings = await db
      .select()
      .from(schema.adminSettings)
      .limit(1);

    if (settings.length === 0) return null;
    return this.convertDatabaseSettings(settings[0]);
  }

  async updateAdminSettings(updates: Partial<AdminSettings>): Promise<void> {
    const existingSettings = await this.getAdminSettings();
    
    if (!existingSettings) {
      // Create new settings if none exist
      await db.insert(schema.adminSettings).values({
        id: 'default',
        voiceId: updates.voiceId || 'pNInz6obpgDQGcFmaJgB',
        voiceDescription: updates.voiceDescription || 'Professional voice',
        personalizationEnabled: updates.personalizationEnabled || false,
        conversationAware: updates.conversationAware !== undefined ? updates.conversationAware : true,
        debugLlmEnabled: updates.debugLlmEnabled || false,
        baseReportPath: updates.baseReportPath,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Filter out undefined values to avoid overwriting with nulls
      const filteredUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);
      
      await db
        .update(schema.adminSettings)
        .set({
          ...filteredUpdates,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.adminSettings.id, 'default'));
    }
  }

  // System Prompt Management
  async getAllSystemPrompts(): Promise<SystemPrompt[]> {
    const prompts = await db
      .select()
      .from(schema.systemPrompts);

    return prompts.map(this.convertDatabasePrompt);
  }

  async uploadSystemPrompt(
    type: 'qa' | 'report' | 'lesson_qa',
    content: string,
    lessonId?: string
  ): Promise<SystemPrompt> {
    const promptId = `${type}_prompt_${Date.now()}`;
    
    // Deactivate existing prompts of this type
    await db
      .update(schema.systemPrompts)
      .set({ active: false })
      .where(eq(schema.systemPrompts.type, type));

    // Insert new prompt
    const newPrompt = await db.insert(schema.systemPrompts).values({
      id: promptId,
      type,
      content,
      lessonId,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    return this.convertDatabasePrompt(newPrompt[0]);
  }

  async updateSystemPrompt(promptId: string, content: string): Promise<void> {
    await db
      .update(schema.systemPrompts)
      .set({
        content,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.systemPrompts.id, promptId));
  }

  async deleteSystemPrompt(promptId: string): Promise<void> {
    await db
      .delete(schema.systemPrompts)
      .where(eq(schema.systemPrompts.id, promptId));
  }

  // Knowledge Base Management
  async uploadKnowledgeBaseFile(
    file: File,
    indexedContent?: string
  ): Promise<KnowledgeBaseFile | KnowledgeBaseFile[]> {
    const content = await file.text();
    const fileType = file.type || 'text/plain';

    // Handle JSON files with multiple entries
    if (fileType === 'application/json') {
      return await this.processJsonKnowledgeBase(file, content);
    }

    // Handle single file upload (existing behavior)
    const fileId = `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newFile = await db.insert(schema.knowledgeBaseFiles).values({
      id: fileId,
      filename: file.name,
      content,
      fileType,
      indexedContent: indexedContent || content, // Use provided indexed content or raw content
      uploadedAt: new Date().toISOString(),
    }).returning();

    return this.convertDatabaseKnowledgeFile(newFile[0]);
  }

  private async processJsonKnowledgeBase(
    file: File,
    content: string
  ): Promise<KnowledgeBaseFile[]> {
    let jsonData: any;
    
    try {
      jsonData = JSON.parse(content);
    } catch (error) {
      throw new Error('Invalid JSON format');
    }

    // Validate JSON structure
    if (!Array.isArray(jsonData)) {
      throw new Error('JSON file must contain an array of knowledge base entries');
    }

    const results: KnowledgeBaseFile[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < jsonData.length; i++) {
      const entry = jsonData[i];
      
      // Validate required fields
      if (!entry.title || !entry.content) {
        throw new Error(`Entry ${i + 1} is missing required fields 'title' or 'content'`);
      }

      const fileId = `kb_${timestamp}_${i}_${Math.random().toString(36).substr(2, 9)}`;
      const filename = `${entry.title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-')}.json`;

      // Prepare content with metadata
      const entryContent = typeof entry.content === 'string' 
        ? entry.content 
        : JSON.stringify(entry.content, null, 2);

      // Create structured metadata
      const metadata = {
        title: entry.title,
        category: entry.category || 'general',
        tags: entry.tags || [],
        source: entry.source || file.name,
        lastUpdated: entry.lastUpdated || new Date().toISOString()
      };

      // Combine content with metadata for indexing
      const indexedContent = `Title: ${metadata.title}
Category: ${metadata.category}
Tags: ${metadata.tags.join(', ')}
Source: ${metadata.source}

${entryContent}`;

      const newFile = await db.insert(schema.knowledgeBaseFiles).values({
        id: fileId,
        filename,
        content: entryContent,
        fileType: 'application/json',
        indexedContent,
        uploadedAt: new Date().toISOString(),
      }).returning();

      results.push(this.convertDatabaseKnowledgeFile(newFile[0]));
    }

    return results;
  }

  async getAllKnowledgeBaseFiles(): Promise<KnowledgeBaseFile[]> {
    const files = await db
      .select()
      .from(schema.knowledgeBaseFiles);

    return files.map(this.convertDatabaseKnowledgeFile);
  }

  async deleteKnowledgeBaseFile(fileId: string): Promise<void> {
    await db
      .delete(schema.knowledgeBaseFiles)
      .where(eq(schema.knowledgeBaseFiles.id, fileId));
  }

  // Base Report Template Management
  async uploadBaseReportTemplate(file: File): Promise<void> {
    if (file.type !== 'application/pdf') {
      throw new Error('Base template must be a PDF file');
    }

    // Read file as binary data
    const arrayBuffer = await file.arrayBuffer();
    const templateData = new Uint8Array(arrayBuffer);
    const filePath = `/uploads/report-templates/${Date.now()}_${file.name}`;
    
    await this.updateAdminSettings({
      baseReportPath: filePath,
      baseReportTemplate: templateData
    });
  }

  async getBaseReportTemplate(): Promise<Uint8Array | null> {
    const settings = await this.getAdminSettings();
    return settings?.baseReportTemplate || null;
  }

  async removeBaseReportTemplate(): Promise<void> {
    await db
      .update(schema.adminSettings)
      .set({
        baseReportPath: null,
        baseReportTemplate: null,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.adminSettings.id, 'default'));
  }

  // Utility Methods

  private convertDatabaseSettings(dbSettings: any): AdminSettings {
    return {
      id: dbSettings.id,
      voiceId: dbSettings.voiceId,
      voiceDescription: dbSettings.voiceDescription,
      personalizationEnabled: Boolean(dbSettings.personalizationEnabled),
      conversationAware: Boolean(dbSettings.conversationAware),
      useStructuredConversation: Boolean(dbSettings.useStructuredConversation),
      debugLlmEnabled: Boolean(dbSettings.debugLlmEnabled),
      baseReportPath: dbSettings.baseReportPath,
      baseReportTemplate: dbSettings.baseReportTemplate,
      updatedAt: new Date(dbSettings.updatedAt),
    };
  }

  private convertDatabasePrompt(dbPrompt: any): SystemPrompt {
    return {
      id: dbPrompt.id,
      type: dbPrompt.type,
      content: dbPrompt.content,
      lessonId: dbPrompt.lessonId,
      active: Boolean(dbPrompt.active),
      createdAt: new Date(dbPrompt.createdAt),
      updatedAt: new Date(dbPrompt.updatedAt),
    };
  }

  private convertDatabaseKnowledgeFile(dbFile: any): KnowledgeBaseFile {
    return {
      id: dbFile.id,
      filename: dbFile.filename,
      content: dbFile.content,
      fileType: dbFile.fileType,
      indexedContent: dbFile.indexedContent,
      uploadedAt: new Date(dbFile.uploadedAt),
    };
  }

  // Bulk Operations (reserved for future use)

  // Report Management
  async getAllReports(): Promise<SessionReport[]> {
    const reports = await db
      .select()
      .from(schema.sessionReports)
      .orderBy(desc(schema.sessionReports.generatedAt));

    return reports.map(this.convertDatabaseReport);
  }

  async getReportsBySession(sessionId: string): Promise<SessionReport[]> {
    const reports = await db
      .select()
      .from(schema.sessionReports)
      .where(eq(schema.sessionReports.sessionId, sessionId))
      .orderBy(desc(schema.sessionReports.generatedAt));

    return reports.map(this.convertDatabaseReport);
  }

  async getReportById(reportId: string): Promise<SessionReport | null> {
    const reports = await db
      .select()
      .from(schema.sessionReports)
      .where(eq(schema.sessionReports.id, reportId))
      .limit(1);

    if (reports.length === 0) return null;
    return this.convertDatabaseReport(reports[0]);
  }

  async deleteReport(reportId: string): Promise<void> {
    await db
      .delete(schema.sessionReports)
      .where(eq(schema.sessionReports.id, reportId));
  }

  async deleteReportsBySession(sessionId: string): Promise<void> {
    await db
      .delete(schema.sessionReports)
      .where(eq(schema.sessionReports.sessionId, sessionId));
  }

  // Analytics & Reporting
  async getContentStatistics(): Promise<{
    totalKnowledgeFiles: number;
    totalSystemPrompts: number;
    totalReports: number;
  }> {
    const [kbFiles, prompts, reports] = await Promise.all([
      this.getAllKnowledgeBaseFiles(),
      this.getAllSystemPrompts(),
      this.getAllReports()
    ]);

    return {
      totalKnowledgeFiles: kbFiles.length,
      totalSystemPrompts: prompts.filter(p => p.active).length,
      totalReports: reports.length,
    };
  }

  async getReportStatistics(): Promise<{
    totalReports: number;
    reportsThisWeek: number;
    reportsThisMonth: number;
    averageReportsPerSession: number;
  }> {
    const reports = await this.getAllReports();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const reportsThisWeek = reports.filter(r => new Date(r.generatedAt) >= weekAgo).length;
    const reportsThisMonth = reports.filter(r => new Date(r.generatedAt) >= monthAgo).length;

    // Count unique sessions with reports
    const uniqueSessions = new Set(reports.map(r => r.sessionId)).size;
    const averageReportsPerSession = uniqueSessions > 0 ? reports.length / uniqueSessions : 0;

    return {
      totalReports: reports.length,
      reportsThisWeek,
      reportsThisMonth,
      averageReportsPerSession: Math.round(averageReportsPerSession * 100) / 100
    };
  }

  private convertDatabaseReport(dbReport: any): SessionReport {
    return {
      id: dbReport.id,
      sessionId: dbReport.sessionId,
      reportPath: dbReport.reportPath,
      generatedAt: new Date(dbReport.generatedAt),
      // reportData is excluded from the return type for security/size reasons
      // but can be accessed directly via the database when needed
    };
  }
}

// Export singleton instance
export const adminService = new AdminService();