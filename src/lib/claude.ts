import Anthropic from '@anthropic-ai/sdk';
import { Article, Message } from '@/types';
import promptsData from '@/data/prompts.json';

export class ClaudeService {
  private client: Anthropic;

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    this.client = new Anthropic({ apiKey });
  }

  private searchRelevantArticles(query: string, limit = 3): Article[] {
    // Return empty array since we no longer have articles.json
    const articles: Article[] = [];
    const queryLower = query.toLowerCase();
    
    // Simple keyword matching - could be enhanced with vector search
    const scoredArticles = articles.map(article => {
      let score = 0;
      const searchableText = `${article.title} ${article.summary} ${article.content} ${article.tags.join(' ')}`.toLowerCase();
      
      // Boost score for title matches
      if (article.title.toLowerCase().includes(queryLower)) score += 10;
      
      // Boost score for category matches
      if (article.category.toLowerCase().includes(queryLower)) score += 5;
      
      // Boost score for tag matches
      article.tags.forEach(tag => {
        if (queryLower.includes(tag.toLowerCase()) || tag.toLowerCase().includes(queryLower)) {
          score += 3;
        }
      });
      
      // Count keyword matches in content
      const words = queryLower.split(/\s+/).filter(word => word.length > 2);
      words.forEach(word => {
        const matches = (searchableText.match(new RegExp(word, 'g')) || []).length;
        score += matches;
      });
      
      return { article, score };
    });
    
    return scoredArticles
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ article }) => article);
  }

  async cleanupVoiceTranscript(transcript: string): Promise<string> {
    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: promptsData.voice_cleanup_prompt.replace('{transcript}', transcript)
        }]
      });

      return message.content[0].type === 'text' ? message.content[0].text.trim() : transcript;
    } catch (error) {
      console.error('Error cleaning up voice transcript:', error);
      return transcript; // Return original if cleanup fails
    }
  }

  async generateResponse(
    messages: Message[],
    userQuery: string
  ): Promise<{ response: string; relevantArticles: Article[] }> {
    try {
      // Search for relevant articles based on the user's query
      const relevantArticles = this.searchRelevantArticles(userQuery);
      
      // Prepare context with relevant articles
      let contextPrompt = promptsData.system_prompt;
      
      if (relevantArticles.length > 0) {
        const articlesContext = relevantArticles.map(article => 
          `Title: ${article.title}\nSummary: ${article.summary}\nContent: ${article.content.substring(0, 1000)}...\n`
        ).join('\n---\n');
        
        contextPrompt += '\n\n' + promptsData.knowledge_context_prompt.replace('{articles}', articlesContext);
      }

      // Convert messages to Claude format
      const claudeMessages = messages.map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      // Add the current query
      claudeMessages.push({
        role: 'user',
        content: userQuery
      });

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system: contextPrompt,
        messages: claudeMessages
      });

      const responseText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : 'I apologize, but I encountered an error generating a response.';

      return {
        response: responseText,
        relevantArticles
      };
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error('Failed to generate response');
    }
  }

  async generateSessionSummary(messages: Message[]): Promise<string> {
    try {
      const messageHistory = messages.map(msg => 
        `${msg.type === 'user' ? 'User' : 'Sanjay'}: ${msg.content}`
      ).join('\n');

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: promptsData.session_summary_prompt.replace('{messages}', messageHistory)
        }]
      });

      return response.content[0].type === 'text' 
        ? response.content[0].text.trim()
        : 'Session summary unavailable';
    } catch (error) {
      console.error('Error generating session summary:', error);
      return 'Session summary unavailable';
    }
  }

  async extractSessionNotes(userMessage: string, assistantMessage: string): Promise<Array<{ content: string; type: 'insight' | 'action' | 'recommendation' | 'question' }>> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: promptsData.note_extraction_prompt
            .replace('{user_message}', userMessage)
            .replace('{assistant_message}', assistantMessage)
        }]
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '[]';
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing extracted notes:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Error extracting session notes:', error);
      return [];
    }
  }

  async generateAutoTherapistNotes(userMessage: string, assistantMessage: string): Promise<string[]> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `As a financial therapist, analyze this conversation exchange and generate 1-3 concise, professional notes that capture:
          
1. Key insights about the client's financial psychology or behavior
2. Important action items or recommendations given
3. Areas for follow-up or deeper exploration

User said: "${userMessage}"
Therapist responded: "${assistantMessage}"

Return only the notes as a JSON array of strings. Each note should be 1-2 sentences maximum.

Example format: ["Client shows anxiety around market volatility, need to explore risk tolerance", "Recommended starting with low-cost index funds", "Follow up on retirement timeline in next session"]`
        }]
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '[]';
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing auto therapist notes:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Error generating auto therapist notes:', error);
      return [];
    }
  }
}

// Singleton instance
let claudeServiceInstance: ClaudeService | null = null;

export function getClaudeService(): ClaudeService {
  if (!claudeServiceInstance) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    claudeServiceInstance = new ClaudeService(apiKey);
  }
  return claudeServiceInstance;
}