export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isVoice?: boolean;
  rawTranscript?: string; // Original voice transcript before cleanup
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  notes: SessionNote[];
  createdAt: Date;
  updatedAt: Date;
  summary?: string;
}

export interface SessionNote {
  id: string;
  content: string;
  type: 'insight' | 'action' | 'recommendation' | 'question';
  timestamp: Date;
  messageId?: string; // Link to the message that generated this note
}

export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  readTime: string;
  author: string;
  lastUpdated: Date;
}

export interface VoiceRecording {
  isRecording: boolean;
  transcript: string;
  confidence?: number;
  error?: string;
}

export interface KnowledgeBaseContext {
  relevantArticles: Article[];
  searchQuery: string;
  confidence: number;
}