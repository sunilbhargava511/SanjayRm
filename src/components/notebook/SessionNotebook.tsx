'use client';

import React, { useState } from 'react';
import { 
  BookOpen, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  Lightbulb, 
  Target, 
  MessageSquare,
  HelpCircle,
  Download
} from 'lucide-react';
import { Session, SessionNote } from '@/types';
import { EnhancedSessionStorage } from '@/lib/session-enhanced';

interface SessionNotebookProps {
  session: Session;
  onSessionUpdate: (session: Session) => void;
}

const noteTypeIcons = {
  insight: <Lightbulb className="w-4 h-4" />,
  action: <Target className="w-4 h-4" />,
  recommendation: <MessageSquare className="w-4 h-4" />,
  question: <HelpCircle className="w-4 h-4" />
};

const noteTypeColors = {
  insight: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  action: 'bg-green-50 border-green-200 text-green-900', 
  recommendation: 'bg-blue-50 border-blue-200 text-blue-900',
  question: 'bg-purple-50 border-purple-200 text-purple-900'
};

const noteTypeLabels = {
  insight: 'Client Insight',
  action: 'Action Item',
  recommendation: 'Recommendation',
  question: 'Follow-up Question'
};

export default function SessionNotebook({ session, onSessionUpdate }: SessionNotebookProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [newNote, setNewNote] = useState({ content: '', type: 'insight' as SessionNote['type'] });
  const [isAddingNote, setIsAddingNote] = useState(false);

  const handleAddNote = () => {
    if (!newNote.content.trim()) return;

    EnhancedSessionStorage.addNote(session.id, {
      content: newNote.content,
      type: newNote.type
    });

    const updatedSession = EnhancedSessionStorage.getSession(session.id);
    if (updatedSession) {
      onSessionUpdate(updatedSession);
    }

    setNewNote({ content: '', type: 'insight' });
    setIsAddingNote(false);
  };

  const handleEditNote = (noteId: string) => {
    const note = session.notes.find(n => n.id === noteId);
    if (note) {
      setEditContent(note.content);
      setEditingNote(noteId);
    }
  };

  const handleSaveEdit = () => {
    if (!editingNote || !editContent.trim()) return;

    EnhancedSessionStorage.updateNote(session.id, editingNote, editContent);
    
    const updatedSession = EnhancedSessionStorage.getSession(session.id);
    if (updatedSession) {
      onSessionUpdate(updatedSession);
    }

    setEditingNote(null);
    setEditContent('');
  };

  const handleDeleteNote = (noteId: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      EnhancedSessionStorage.deleteNote(session.id, noteId);
      
      const updatedSession = EnhancedSessionStorage.getSession(session.id);
      if (updatedSession) {
        onSessionUpdate(updatedSession);
      }
    }
  };

  const handleExportSession = () => {
    const content = EnhancedSessionStorage.exportSession(session.id, {
      includeMessages: true,
      includeNotes: true,
      includeSummary: true,
      format: 'txt'
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title.replace(/[^a-zA-Z0-9]/g, '_')}_${session.createdAt.toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-medium text-gray-900">Therapist Notebook</h3>
            <p className="text-sm text-gray-500">
              Session insights • {session.notes.length} entries • {session.updatedAt.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExportSession();
            }}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Export session"
          >
            <Download className="w-4 h-4" />
          </button>
          <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200">
          <div className="p-4">
            {session.summary && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Session Summary</h4>
                <p className="text-sm text-gray-600">{session.summary}</p>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-700">Clinical Notes & Observations</h4>
              <button
                onClick={() => setIsAddingNote(true)}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Observation
              </button>
            </div>

            {isAddingNote && (
              <div className="mb-4 p-3 border border-gray-300 rounded-lg">
                <div className="flex gap-2 mb-2">
                  {(['insight', 'action', 'recommendation', 'question'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewNote({ ...newNote, type })}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                        newNote.type === type
                          ? noteTypeColors[type]
                          : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {noteTypeIcons[type]}
                      {noteTypeLabels[type]}
                    </button>
                  ))}
                </div>
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  placeholder="Enter your note..."
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleAddNote}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingNote(false);
                      setNewNote({ content: '', type: 'insight' });
                    }}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {session.notes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No observations recorded yet.</p>
                  <p className="text-xs mt-1">Use the button above to add insights from the conversation.</p>
                </div>
              ) : (
                session.notes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-3 rounded-lg border ${noteTypeColors[note.type]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {noteTypeIcons[note.type]}
                          <span className="text-xs font-medium uppercase tracking-wide">
                            {noteTypeLabels[note.type]}
                          </span>
                          <span className="text-xs opacity-75">
                            {note.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        {editingNote === note.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full p-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveEdit}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                              >
                                <Save className="w-3 h-3" />
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingNote(null);
                                  setEditContent('');
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed">{note.content}</p>
                        )}
                      </div>
                      {editingNote !== note.id && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditNote(note.id)}
                            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                            title="Edit note"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                            title="Delete note"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}