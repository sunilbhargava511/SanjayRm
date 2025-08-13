import { sqliteTable, text, integer, blob, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Content chunks for educational delivery
export const contentChunks = sqliteTable('content_chunks', {
  id: text('id').primaryKey(),
  orderIndex: integer('order_index').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  question: text('question').notNull(),
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Administrator settings
export const adminSettings = sqliteTable('admin_settings', {
  id: text('id').primaryKey().default('default'),
  voiceId: text('voice_id').notNull().default('pNInz6obpgDQGcFmaJgB'),
  voiceDescription: text('voice_description').notNull().default('Professional, clear voice for financial education'),
  personalizationEnabled: integer('personalization_enabled', { mode: 'boolean' }).default(false),
  conversationAware: integer('conversation_aware', { mode: 'boolean' }).default(true), // Enable smooth lead-ins by default
  useStructuredConversation: integer('use_structured_conversation', { mode: 'boolean' }).default(true),
  baseReportPath: text('base_report_path'),
  baseReportTemplate: blob('base_report_template'), // PDF template as binary data
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// System prompts for different purposes
export const systemPrompts = sqliteTable('system_prompts', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'content' | 'qa' | 'report'
  content: text('content').notNull(),
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Knowledge base files
export const knowledgeBaseFiles = sqliteTable('knowledge_base_files', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  content: text('content').notNull(),
  fileType: text('file_type').notNull(),
  indexedContent: text('indexed_content'), // Processed content for search
  uploadedAt: text('uploaded_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Conversations (renamed from educational_sessions for clarity)
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  conversationType: text('conversation_type').notNull().default('structured'), // 'structured' | 'open-ended'
  userId: text('user_id'), // Optional user identification
  currentChunkIndex: integer('current_chunk_index').default(0), // Which chunk to deliver next (for structured)
  chunkLastDelivered: integer('chunk_last_delivered').default(0), // Last chunk delivered (for structured)
  completed: integer('completed', { mode: 'boolean' }).default(false),
  personalizationEnabled: integer('personalization_enabled', { mode: 'boolean' }).default(false),
  conversationAware: integer('conversation_aware', { mode: 'boolean' }), // NULL = use admin default, true/false = override
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Keep old export for backward compatibility during migration
export const educationalSessions = conversations;

// Session progress tracking
export const sessionProgress = sqliteTable('session_progress', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  chunkId: text('chunk_id').notNull(),
  userResponse: text('user_response').notNull(),
  aiResponse: text('ai_response').notNull(),
  timestamp: text('timestamp').default(sql`(CURRENT_TIMESTAMP)`),
});

// Generated session reports
export const sessionReports = sqliteTable('session_reports', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  reportPath: text('report_path').notNull(),
  reportData: blob('report_data'), // PDF binary data
  generatedAt: text('generated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Export types for TypeScript
export type ContentChunk = typeof contentChunks.$inferSelect;
export type NewContentChunk = typeof contentChunks.$inferInsert;

export type AdminSettings = typeof adminSettings.$inferSelect;
export type NewAdminSettings = typeof adminSettings.$inferInsert;

export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type NewSystemPrompt = typeof systemPrompts.$inferInsert;

export type KnowledgeBaseFile = typeof knowledgeBaseFiles.$inferSelect;
export type NewKnowledgeBaseFile = typeof knowledgeBaseFiles.$inferInsert;

export type EducationalSession = typeof educationalSessions.$inferSelect;
export type NewEducationalSession = typeof educationalSessions.$inferInsert;

export type SessionProgress = typeof sessionProgress.$inferSelect;
export type NewSessionProgress = typeof sessionProgress.$inferInsert;

export type SessionReport = typeof sessionReports.$inferSelect;
export type NewSessionReport = typeof sessionReports.$inferInsert;