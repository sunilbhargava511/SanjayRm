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