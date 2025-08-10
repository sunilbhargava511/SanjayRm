import Anthropic from '@anthropic-ai/sdk';
import { Message, SessionNote, Article } from '@/types';
import { knowledgeSearch, SearchResult } from './knowledge-search';
import { SYSTEM_PROMPTS } from './system-prompts';

export interface ClaudeConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

export interface AutoNoteConfig {
  maxNotes: number;
  extractInsights: boolean;
  extractActions: boolean;
  extractQuestions: boolean;
  extractRecommendations: boolean;
}

export interface RAGResponse {
  response: string;
  citedArticles: Article[];
  searchResults: SearchResult[];
}

export class EnhancedClaudeService {
  private client: Anthropic;
  private config: ClaudeConfig;
  private autoNoteConfig: AutoNoteConfig;

  // Default configurations
  static readonly DEFAULT_CONFIG: ClaudeConfig = {
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4000,
    temperature: 0.7,
    systemPrompt: SYSTEM_PROMPTS.financial_advisor
  };

  static readonly DEFAULT_AUTO_NOTE_CONFIG: AutoNoteConfig = {
    maxNotes: 5,
    extractInsights: true,
    extractActions: true,
    extractQuestions: true,
    extractRecommendations: true
  };

  constructor(
    config: Partial<ClaudeConfig> = {},
    autoNoteConfig: Partial<AutoNoteConfig> = {}
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.client = new Anthropic({ apiKey });
    this.config = { ...EnhancedClaudeService.DEFAULT_CONFIG, ...config };
    this.autoNoteConfig = { ...EnhancedClaudeService.DEFAULT_AUTO_NOTE_CONFIG, ...autoNoteConfig };
  }

  // RAG-enhanced conversation method
  async sendMessageWithContext(
    messages: Message[],
    userMessage: string
  ): Promise<RAGResponse> {
    try {
      // Search for relevant articles
      const searchResults = knowledgeSearch.findRelevantArticles(userMessage, 3);
      
      // Generate context from search results
      const contextSummary = knowledgeSearch.generateContextSummary(searchResults);
      
      // Create enhanced system prompt with context
      const enhancedPrompt = contextSummary 
        ? `${SYSTEM_PROMPTS.financial_advisor_with_context}

RELEVANT KNOWLEDGE BASE CONTENT:
${contextSummary}

Use this context to provide informed, specific advice while maintaining your warm, conversational tone.`
        : SYSTEM_PROMPTS.financial_advisor;

      // Get Claude's response
      const response = await this.sendMessage(messages, enhancedPrompt);

      return {
        response,
        citedArticles: searchResults.map(r => r.article),
        searchResults
      };
    } catch (error) {
      console.error('Error in RAG-enhanced conversation:', error);
      // Fallback to regular conversation
      const response = await this.sendMessage(messages);
      return {
        response,
        citedArticles: [],
        searchResults: []
      };
    }
  }

  // Core conversation method
  async sendMessage(
    messages: Message[], 
    systemPrompt?: string
  ): Promise<string> {
    try {
      const formattedMessages = messages.map(msg => ({
        role: (msg.type || msg.sender) === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt || this.config.systemPrompt,
        messages: formattedMessages
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
      
      throw new Error('Unexpected response format from Claude');
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Failed to get response from Claude: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate session summary
  async generateSessionSummary(messages: Message[]): Promise<string> {
    if (messages.length === 0) {
      return 'No conversation recorded in this session.';
    }

    const summaryPrompt = `Analyze this financial counseling conversation and provide a concise session summary (2-3 sentences) focusing on:
- Key topics discussed
- Client's main concerns or goals
- Overall session outcome

Keep it professional and suitable for session records.`;

    try {
      return await this.sendMessage(messages, summaryPrompt);
    } catch (error) {
      console.error('Error generating session summary:', error);
      return `Session on ${new Date().toLocaleDateString()} - Summary generation failed`;
    }
  }

  // Extract structured session notes
  async extractSessionNotes(userMessage: string, assistantMessage: string): Promise<SessionNote[]> {
    const extractPrompt = `${SYSTEM_PROMPTS.note_extractor}

User: ${userMessage}
Assistant: ${assistantMessage}`;

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent JSON
        system: extractPrompt,
        messages: [{ role: 'user', content: 'Extract notes from the conversation above.' }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format');
      }

      // Parse JSON response
      const notesData = JSON.parse(content.text);
      if (!Array.isArray(notesData)) {
        throw new Error('Response is not an array');
      }

      // Convert to SessionNote format
      const notes: SessionNote[] = notesData
        .filter(note => note.content && note.type)
        .slice(0, this.autoNoteConfig.maxNotes)
        .map(note => ({
          id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: note.content,
          type: note.type,
          timestamp: new Date(),
          autoGenerated: true,
          priority: note.priority || 'medium'
        }));

      return notes;
    } catch (error) {
      console.error('Error extracting session notes:', error);
      return [];
    }
  }

  // Generate auto therapist notes (enhanced version)
  async generateAutoTherapistNotes(userMessage: string, assistantMessage: string): Promise<SessionNote[]> {
    const analysisPrompt = `${SYSTEM_PROMPTS.session_analyzer}

Analyze this exchange and generate up to ${this.autoNoteConfig.maxNotes} structured notes:

User: ${userMessage}
Assistant: ${assistantMessage}

Return notes as JSON array with format:
[{"type": "insight|action|recommendation|question", "content": "note text", "priority": "high|medium|low"}]`;

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 1500,
        temperature: 0.4,
        system: analysisPrompt,
        messages: [{ role: 'user', content: 'Generate therapist notes.' }]
      });

      const content = response.content[0];
      if (content.type !== 'text') return [];

      const notesData = JSON.parse(content.text);
      if (!Array.isArray(notesData)) return [];

      // Filter based on auto-note configuration
      const filteredNotes = notesData.filter(note => {
        switch (note.type) {
          case 'insight': return this.autoNoteConfig.extractInsights;
          case 'action': return this.autoNoteConfig.extractActions;
          case 'recommendation': return this.autoNoteConfig.extractRecommendations;
          case 'question': return this.autoNoteConfig.extractQuestions;
          default: return true;
        }
      });

      return filteredNotes
        .slice(0, this.autoNoteConfig.maxNotes)
        .map(note => ({
          id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: note.content,
          type: note.type,
          timestamp: new Date(),
          autoGenerated: true,
          priority: note.priority || 'medium'
        }));

    } catch (error) {
      console.error('Error generating auto notes:', error);
      return [];
    }
  }

  // Generate introduction message
  async generateIntroduction(userName?: string): Promise<string> {
    const introPrompt = `Generate a warm, welcoming introduction from Sanjay to start a financial counseling session. ${userName ? `The client's name is ${userName}.` : 'The client name is unknown.'} 

Keep it:
- Under 100 words
- Warm and professional
- Focused on creating a safe space
- Encouraging about the financial journey ahead`;

    const introMessages: Message[] = [{
      id: 'intro_prompt',
      content: 'Please introduce yourself and welcome me to start our financial counseling session.',
      type: 'user',
      timestamp: new Date()
    }];

    try {
      return await this.sendMessage(introMessages, introPrompt);
    } catch (error) {
      console.error('Error generating introduction:', error);
      throw error; // Don't provide fallback - let caller handle the error
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<ClaudeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  updateAutoNoteConfig(newConfig: Partial<AutoNoteConfig>): void {
    this.autoNoteConfig = { ...this.autoNoteConfig, ...newConfig };
  }

  // Get current configuration
  getConfig(): ClaudeConfig {
    return { ...this.config };
  }

  getAutoNoteConfig(): AutoNoteConfig {
    return { ...this.autoNoteConfig };
  }
}

// Service factory function (matches existing pattern)
export function getClaudeService(): EnhancedClaudeService {
  return new EnhancedClaudeService();
}

// Utility functions for API integration
export class ClaudeAPIHelper {
  // Client-side API calls (for use in components)
  static async generateSessionSummary(messages: Message[]): Promise<string> {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateSummary',
          messages
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'API call failed');
      }

      return data.summary;
    } catch (error) {
      console.error('Error calling session summary API:', error);
      throw error;
    }
  }

  static async generateAutoNotes(userMessage: string, assistantMessage: string): Promise<SessionNote[]> {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateAutoNotes',
          userMessage,
          assistantMessage
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'API call failed');
      }

      return data.notes || [];
    } catch (error) {
      console.error('Error calling auto notes API:', error);
      return [];
    }
  }

  static async extractSessionNotes(userMessage: string, assistantMessage: string): Promise<SessionNote[]> {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extractNotes',
          userMessage,
          assistantMessage
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'API call failed');
      }

      return data.notes || [];
    } catch (error) {
      console.error('Error calling extract notes API:', error);
      return [];
    }
  }
}