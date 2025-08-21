# Financial Advisor Database Schema Documentation

This document describes the complete database schema for the Sanjay Bhargava Financial Advisor application. The application uses SQLite as its database engine with a well-structured schema supporting lessons, conversations, debugging, and administration.

## Table of Contents

- [Core Application Tables](#core-application-tables)
- [Session & Conversation Management](#session--conversation-management)
- [Administrative Tables](#administrative-tables)
- [Debug & Monitoring Tables](#debug--monitoring-tables)
- [Legacy Tables](#legacy-tables)
- [Relationships](#relationships)
- [Database Operations](#database-operations)

## Core Application Tables

### `lessons`
**Purpose**: Stores educational lessons for structured learning modules.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key, unique lesson identifier |
| `title` | TEXT | Human-readable lesson title |
| `video_url` | TEXT | YouTube URL for lesson video |
| `video_summary` | TEXT | Context summary for LLM during Q&A |
| `start_message` | TEXT | TTS message played before video |
| `order_index` | INTEGER | Lesson sequence order |
| `prerequisites` | TEXT | JSON array of prerequisite lesson IDs |
| `active` | BOOLEAN | Whether lesson is currently active |
| `created_at` | TEXT | ISO timestamp of creation |
| `updated_at` | TEXT | ISO timestamp of last update |

**Usage**: Central repository for educational content delivery.

### `user_sessions`
**Purpose**: Tracks user progress across multiple lessons.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key, unique session identifier |
| `user_id` | TEXT | Optional user identification |
| `completed_lessons` | TEXT | JSON array of completed lesson IDs |
| `current_lesson_id` | TEXT | Currently active lesson |
| `created_at` | TEXT | Session start timestamp |
| `updated_at` | TEXT | Last activity timestamp |

**Usage**: Progress tracking for educational journeys.

### `lesson_conversations`
**Purpose**: Individual Q&A conversations for each lesson.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `session_id` | TEXT | References `user_sessions.id` |
| `lesson_id` | TEXT | References `lessons.id` |
| `conversation_id` | TEXT | ElevenLabs conversation ID |
| `completed` | BOOLEAN | Whether conversation is finished |
| `messages_count` | INTEGER | Number of messages exchanged |
| `created_at` | TEXT | Conversation start timestamp |
| `updated_at` | TEXT | Last activity timestamp |

**Usage**: Links ElevenLabs conversations to specific lessons.

### `knowledge_base_files`
**Purpose**: Stores knowledge base content for RAG (Retrieval Augmented Generation).

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `filename` | TEXT | Original filename |
| `content` | TEXT | Full file content |
| `file_type` | TEXT | File type (txt, md, pdf, etc.) |
| `indexed_content` | TEXT | Processed content for search |
| `uploaded_at` | TEXT | Upload timestamp |

**Usage**: Knowledge retrieval for enhanced AI responses.

## Session & Conversation Management

### `conversation_sessions`
**Purpose**: Unified session management for all conversation types.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `user_id` | TEXT | Optional user identifier |
| `session_type` | TEXT | 'open_ended' or 'lesson_based' |
| `lesson_phase` | TEXT | Current phase in lesson flow |
| `current_lesson_id` | TEXT | Active lesson (if lesson-based) |
| `elevenlabs_conversation_id` | TEXT | Voice conversation ID |
| `status` | TEXT | 'active', 'paused', or 'completed' |
| `started_at` | TEXT | Session start time |
| `ended_at` | TEXT | Session end time |
| `created_at` | TEXT | Record creation time |
| `updated_at` | TEXT | Last update time |

**Usage**: Central session orchestration for all conversation types.

### `conversation_messages`
**Purpose**: Complete message transcript for all conversations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `session_id` | TEXT | References `conversation_sessions.id` |
| `message_type` | TEXT | Message classification |
| `content` | TEXT | Actual message text |
| `speaker` | TEXT | 'user', 'assistant', or 'system' |
| `elevenlabs_message_id` | TEXT | ElevenLabs message reference |
| `lesson_context_id` | TEXT | Related lesson context |
| `timestamp` | TEXT | Message timestamp |
| `metadata` | TEXT | JSON metadata |
| `created_at` | TEXT | Record creation time |

**Message Types**:
- `tts_opening`: Opening TTS message
- `tts_lesson_intro`: Lesson introduction
- `user_voice`: User voice input
- `assistant_voice`: AI voice response
- `llm_qa_start`: Q&A session start
- `system`: System messages

**Usage**: Complete audit trail of all conversations.

### `conversations` (Legacy)
**Purpose**: Legacy educational sessions table for backward compatibility.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `conversation_id` | TEXT | ElevenLabs conversation ID |
| `conversation_type` | TEXT | 'structured' or 'open-ended' |
| `user_id` | TEXT | Optional user identification |
| `completed` | BOOLEAN | Completion status |
| `personalization_enabled` | BOOLEAN | Personalization setting |
| `conversation_aware` | BOOLEAN | Context awareness setting |
| `created_at` | TEXT | Creation timestamp |
| `updated_at` | TEXT | Update timestamp |

**Usage**: Maintains compatibility with legacy code during migration.

### `session_progress`
**Purpose**: Tracks Q&A progress within sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `session_id` | TEXT | Session reference |
| `chunk_id` | TEXT | Content chunk identifier |
| `user_response` | TEXT | User's response |
| `ai_response` | TEXT | AI's response |
| `timestamp` | TEXT | Interaction timestamp |

**Usage**: Fine-grained progress tracking within conversations.

## Administrative Tables

### `admin_settings`
**Purpose**: Global application configuration.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key (always 'default') |
| `voice_id` | TEXT | ElevenLabs voice ID |
| `voice_description` | TEXT | Voice description |
| `personalization_enabled` | BOOLEAN | Global personalization setting |
| `conversation_aware` | BOOLEAN | Conversation context awareness |
| `use_structured_conversation` | BOOLEAN | Structured conversation mode |
| `debug_llm_enabled` | BOOLEAN | Debug logging enabled |
| `base_report_path` | TEXT | Report template path |
| `base_report_template` | BLOB | PDF template binary data |
| `updated_at` | TEXT | Last update timestamp |

**Usage**: Single source of truth for application configuration.

### `system_prompts`
**Purpose**: AI system prompts for different contexts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `type` | TEXT | Prompt type |
| `content` | TEXT | Full prompt text |
| `lesson_id` | TEXT | Specific lesson (if lesson-specific) |
| `active` | BOOLEAN | Whether prompt is active |
| `created_at` | TEXT | Creation timestamp |
| `updated_at` | TEXT | Update timestamp |

**Prompt Types**:
- `qa`: General Q&A prompts
- `lesson_qa`: Lesson-specific Q&A
- `report`: Session report generation

**Usage**: Centralized prompt management for AI interactions.

### `opening_messages`
**Purpose**: Admin-configured opening messages with audio caching.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `type` | TEXT | Message type |
| `lesson_id` | TEXT | Associated lesson (if lesson-specific) |
| `message_content` | TEXT | TTS message text |
| `voice_settings` | TEXT | JSON voice configuration |
| `active` | BOOLEAN | Whether message is active |
| `audio_url` | TEXT | Cached audio URL |
| `audio_blob` | TEXT | Base64 encoded audio |
| `audio_generated_at` | TEXT | Audio generation timestamp |
| `audio_hash` | TEXT | Content + settings hash |
| `audio_duration` | REAL | Audio duration in seconds |
| `created_at` | TEXT | Creation timestamp |
| `updated_at` | TEXT | Update timestamp |

**Message Types**:
- `general_opening`: General conversation starter
- `lesson_intro`: Lesson-specific introduction

**Usage**: Provides consistent, pre-generated opening messages with audio caching.

### `audio_cache`
**Purpose**: Additional audio file caching and management.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `message_id` | TEXT | References `opening_messages.id` |
| `audio_data` | TEXT | Base64 encoded audio |
| `file_path` | TEXT | Optional file system path |
| `mime_type` | TEXT | Audio MIME type |
| `size_bytes` | INTEGER | File size |
| `duration_seconds` | REAL | Audio duration |
| `voice_id` | TEXT | ElevenLabs voice used |
| `voice_settings` | TEXT | JSON voice settings |
| `generated_at` | TEXT | Generation timestamp |
| `accessed_at` | TEXT | Last access timestamp |
| `access_count` | INTEGER | Access frequency counter |

**Usage**: Efficient audio caching with metadata and usage tracking.

## Debug & Monitoring Tables

### `debug_sessions`
**Purpose**: Groups debug entries into logical sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `title` | TEXT | Human-readable session title |
| `start_time` | TEXT | Session start timestamp |
| `end_time` | TEXT | Session end timestamp |
| `is_active` | BOOLEAN | Whether session is currently active |
| `created_at` | TEXT | Record creation timestamp |

**Usage**: Organizes debug information for analysis and monitoring.

### `debug_entries`
**Purpose**: Detailed logging of all LLM interactions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `session_id` | TEXT | References `debug_sessions.id` |
| `timestamp` | TEXT | Entry timestamp |
| `type` | TEXT | Entry type |
| `status` | TEXT | 'pending', 'success', or 'error' |
| `request_model` | TEXT | AI model used |
| `request_system_prompt` | TEXT | System prompt sent |
| `request_messages` | TEXT | JSON conversation history |
| `request_temperature` | REAL | Temperature parameter |
| `request_max_tokens` | INTEGER | Token limit |
| `request_knowledge_context` | TEXT | RAG context used |
| `request_other_params` | TEXT | JSON additional parameters |
| `response_content` | TEXT | AI response text |
| `response_processing_time` | INTEGER | Processing time in milliseconds |
| `response_tokens` | INTEGER | Response token count |
| `response_cited_articles` | TEXT | JSON cited knowledge articles |
| `error_message` | TEXT | Error details if failed |
| `created_at` | TEXT | Record creation timestamp |

**Entry Types**:
- `claude`: Claude AI interactions
- `knowledge-search`: Knowledge base searches
- `rag`: Retrieval Augmented Generation calls

**Usage**: Complete audit trail for debugging and performance monitoring.

### `session_events`
**Purpose**: High-level session event tracking for debugging.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `session_id` | TEXT | Application session ID |
| `debug_session_id` | TEXT | References `debug_sessions.id` |
| `event_type` | TEXT | Event classification |
| `title` | TEXT | Human-readable event title |
| `summary` | TEXT | Event summary |
| `first_message` | TEXT | Initial message if applicable |
| `status` | TEXT | 'active', 'completed', or 'interrupted' |
| `icon` | TEXT | UI icon identifier |
| `metadata` | TEXT | JSON event-specific data |
| `timestamp` | TEXT | Event timestamp |
| `created_at` | TEXT | Record creation timestamp |
| `updated_at` | TEXT | Last update timestamp |

**Event Types**:
- `session_started`: New session initiated
- `elevenlabs_conversation_started`: Voice conversation began
- `lesson_started`: Lesson delivery started
- `lesson_qa_started`: Q&A phase began
- `open_conversation_started`: Open-ended chat started

**Usage**: High-level session flow tracking for debugging and analytics.

## Legacy Tables

### `session_reports`
**Purpose**: Generated PDF session reports (legacy).

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `session_id` | TEXT | Session reference |
| `report_path` | TEXT | File system path to report |
| `report_data` | BLOB | PDF binary data |
| `generated_at` | TEXT | Generation timestamp |

**Status**: Legacy table, reports now handled differently.

## Relationships

### Core Relationships
```
user_sessions (1) → (many) lesson_conversations
lessons (1) → (many) lesson_conversations
conversation_sessions (1) → (many) conversation_messages
debug_sessions (1) → (many) debug_entries
debug_sessions (1) → (many) session_events
opening_messages (1) → (many) audio_cache
```

### Referential Integrity
- `lesson_conversations.session_id` → `user_sessions.id`
- `lesson_conversations.lesson_id` → `lessons.id`
- `conversation_messages.session_id` → `conversation_sessions.id`
- `debug_entries.session_id` → `debug_sessions.id`
- `session_events.debug_session_id` → `debug_sessions.id`
- `audio_cache.message_id` → `opening_messages.id` (with cascade delete)

## Database Operations

### Initialization
```bash
# Initialize complete schema
curl -X POST https://thegoldenpath.fly.dev/api/init-database
```

### Migrations
```bash
# Run database migrations
curl -X POST https://thegoldenpath.fly.dev/api/migrate
```

### Debug Data Management
```bash
# Clear debug data
curl -X POST https://thegoldenpath.fly.dev/api/debug-llm \
  -H "Content-Type: application/json" \
  -d '{"action": "clear"}'

# Get debug statistics
curl https://thegoldenpath.fly.dev/api/debug-llm?action=stats
```

### Database Backup (Production)
```bash
# Access production database
fly ssh console
sqlite3 /data/database.sqlite .dump > backup.sql
```

### Complete Database Recreation
```bash
# Delete database file
fly ssh console
rm /data/database.sqlite
exit

# Restart application
fly machine restart

# Reinitialize schema
curl -X POST https://thegoldenpath.fly.dev/api/init-database
```

## Schema Evolution

### Migration Strategy
1. **Backward Compatibility**: Legacy tables maintained during transitions
2. **Gradual Migration**: New features use new schema, old features continue working
3. **Data Preservation**: Migrations preserve existing data
4. **Rollback Safety**: Schema changes are reversible

### Current Migration Status
- ✅ `conversations` table added for legacy compatibility
- ✅ New unified session system (`conversation_sessions`, `conversation_messages`)
- ✅ Enhanced debug system (`debug_sessions`, `debug_entries`, `session_events`)
- ✅ Audio caching system (`opening_messages`, `audio_cache`)
- 🔄 Gradual migration from legacy to new session system

## Performance Considerations

### Indexes
- Primary keys are automatically indexed
- Consider adding indexes on frequently queried foreign keys
- `conversation_messages.session_id` may benefit from indexing
- `debug_entries.session_id` and `debug_entries.timestamp` for performance

### Storage
- SQLite file located at `/data/database.sqlite` in production
- Text fields used for JSON storage (SQLite JSON support limited)
- BLOB fields for binary data (PDFs, audio)
- Timestamps stored as ISO 8601 text strings

### Cleanup
- Debug tables can grow large - regular cleanup recommended
- Audio cache has usage tracking for cleanup decisions
- Session data retention policy should be established

---

**Last Updated**: August 2025  
**Schema Version**: 2.0 (Unified Session System)  
**Database Engine**: SQLite 3.x