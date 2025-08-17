import { NextRequest, NextResponse } from 'next/server';
import { sqlite } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting database migration...');
    
    // Check if lesson_id column exists in system_prompts table
    const tableInfo = sqlite.prepare(`PRAGMA table_info(system_prompts)`).all();
    const hasLessonIdColumn = tableInfo.some((col: any) => col.name === 'lesson_id');
    
    if (!hasLessonIdColumn) {
      console.log('Adding lesson_id column to system_prompts table...');
      sqlite.exec(`ALTER TABLE system_prompts ADD COLUMN lesson_id TEXT;`);
      console.log('✅ Added lesson_id column');
    } else {
      console.log('✅ lesson_id column already exists');
    }
    
    // Check if lessons table exists
    const tablesResult = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='lessons'
    `).all();
    
    if (tablesResult.length === 0) {
      console.log('Creating lessons table...');
      sqlite.exec(`
        CREATE TABLE lessons (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          video_url TEXT NOT NULL,
          video_summary TEXT NOT NULL,
          start_message TEXT,
          question TEXT NOT NULL,
          prerequisites TEXT DEFAULT '[]',
          order_index INTEGER DEFAULT 0,
          active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
          updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
        );
      `);
      console.log('✅ Created lessons table');
    } else {
      console.log('✅ lessons table already exists');
      
      // Check if start_message column exists in lessons table
      const lessonsTableInfo = sqlite.prepare(`PRAGMA table_info(lessons)`).all();
      const hasStartMessageColumn = lessonsTableInfo.some((col: any) => col.name === 'start_message');
      
      if (!hasStartMessageColumn) {
        console.log('Adding start_message column to lessons table...');
        sqlite.exec(`ALTER TABLE lessons ADD COLUMN start_message TEXT;`);
        console.log('✅ Added start_message column');
      } else {
        console.log('✅ start_message column already exists');
      }
    }
    
    // Create new unified session tables
    console.log('Creating unified session system tables...');
    
    // Check if conversation_sessions table exists
    const sessionsTableExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='conversation_sessions'
    `).all();
    
    if (sessionsTableExists.length === 0) {
      console.log('Creating conversation_sessions table...');
      sqlite.exec(`
        CREATE TABLE conversation_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          session_type TEXT NOT NULL,
          lesson_phase TEXT,
          current_lesson_id TEXT,
          elevenlabs_conversation_id TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          started_at TEXT DEFAULT (CURRENT_TIMESTAMP),
          ended_at TEXT,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
          updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
        );
      `);
      console.log('✅ Created conversation_sessions table');
    } else {
      console.log('✅ conversation_sessions table already exists');
    }
    
    // Check if conversation_messages table exists
    const messagesTableExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='conversation_messages'
    `).all();
    
    if (messagesTableExists.length === 0) {
      console.log('Creating conversation_messages table...');
      sqlite.exec(`
        CREATE TABLE conversation_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          message_type TEXT NOT NULL,
          content TEXT NOT NULL,
          speaker TEXT NOT NULL,
          elevenlabs_message_id TEXT,
          lesson_context_id TEXT,
          timestamp TEXT DEFAULT (CURRENT_TIMESTAMP),
          metadata TEXT,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
        );
      `);
      console.log('✅ Created conversation_messages table');
    } else {
      console.log('✅ conversation_messages table already exists');
    }
    
    // Check if opening_messages table exists
    const openingTableExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='opening_messages'
    `).all();
    
    if (openingTableExists.length === 0) {
      console.log('Creating opening_messages table...');
      sqlite.exec(`
        CREATE TABLE opening_messages (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          lesson_id TEXT,
          message_content TEXT NOT NULL,
          voice_settings TEXT,
          active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
          updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
        );
      `);
      console.log('✅ Created opening_messages table');
    } else {
      console.log('✅ opening_messages table already exists');
    }
    
    console.log('Database migration completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully'
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown migration error' 
      },
      { status: 500 }
    );
  }
}