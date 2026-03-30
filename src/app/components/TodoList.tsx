'use client';

import { useState, useRef, useCallback } from 'react';
import { Todo } from '@/app/types';

interface TodoListProps {
  todos: Todo[];
  input: string;
  setInput: (value: string) => void;
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  dark: boolean;
  onToggleTheme: () => void;
}

export default function TodoList({ todos, input, setInput, onAdd, onToggle, onDelete, onEdit, onReorder, dark, onToggleTheme }: TodoListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Touch drag state
  const touchDragIndex = useRef<number | null>(null);
  const touchStartY = useRef<number>(0);
  const touchActive = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onAdd(text);
    setInput('');
  }

  function startEditing(todo: Todo) {
    setEditingId(todo.id);
    setEditText(todo.text);
  }

  function saveEdit() {
    if (editingId && editText.trim()) {
      onEdit(editingId, editText.trim());
    }
    setEditingId(null);
    setEditText('');
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') {
      setEditingId(null);
      setEditText('');
    }
  }

  // HTML5 Drag and Drop (desktop)
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(from) && from !== index) {
      onReorder(from, index);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  // Touch drag (mobile)
  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    touchStartY.current = e.touches[0].clientY;
    touchDragIndex.current = index;

    longPressTimer.current = setTimeout(() => {
      touchActive.current = true;
      setDragIndex(index);
    }, 150);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchActive.current) {
      // If moved too far before long press, cancel
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dy > 10 && longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      return;
    }

    e.preventDefault();
    const touchY = e.touches[0].clientY;

    // Find which item we're over
    let overIndex: number | null = null;
    itemRefs.current.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      if (touchY >= rect.top && touchY <= rect.bottom) {
        overIndex = idx;
      }
    });

    if (overIndex !== null) {
      setDragOverIndex(overIndex);
    }

    // Auto-scroll near edges
    const container = scrollContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      if (touchY - rect.top < 50) {
        container.scrollBy(0, -8);
      } else if (rect.bottom - touchY < 50) {
        container.scrollBy(0, 8);
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (touchActive.current && touchDragIndex.current !== null && dragOverIndex !== null && touchDragIndex.current !== dragOverIndex) {
      onReorder(touchDragIndex.current, dragOverIndex);
    }

    touchActive.current = false;
    touchDragIndex.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragOverIndex, onReorder]);

  return (
    <div className="w-full md:h-[calc(100vh-2rem)] md:flex md:flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Todo App</h1>
        <button
          onClick={onToggleTheme}
          className="rounded-lg border border-foreground/20 px-3 py-1.5 text-sm hover:bg-foreground/10 transition-colors"
        >
          {dark ? '\u2600\uFE0F Light' : '\uD83C\uDF19 Dark'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="What needs to be done?"
          className="flex-1 rounded-lg border border-foreground/20 bg-background px-4 py-2 text-foreground placeholder:text-foreground/40 outline-none focus:border-foreground/50"
        />
        <button
          type="submit"
          className="rounded-lg bg-foreground text-background px-5 py-2 font-medium hover:opacity-80 transition-opacity"
        >
          Add
        </button>
      </form>

      <div ref={scrollContainerRef} className="md:flex-1 md:overflow-y-auto">
      {todos.length === 0 ? (
        <p className="text-center text-foreground/50 py-8">No todos yet. Add one above!</p>
      ) : (
        <ul className="space-y-1">
          {todos.map((todo, index) => (
            <li
              key={todo.id}
              ref={(el) => { if (el) itemRefs.current.set(index, el); }}
              draggable={editingId !== todo.id}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-foreground/5 transition-colors group ${
                dragIndex === index ? 'opacity-30 scale-95' : ''
              } ${
                dragOverIndex === index && dragIndex !== index ? 'border-t-2 border-foreground/50' : 'border-t-2 border-transparent'
              }`}
            >
              {/* Drag handle */}
              <span
                className="flex-shrink-0 cursor-grab active:cursor-grabbing text-foreground/20 hover:text-foreground/50 select-none touch-none text-sm"
                onTouchStart={(e) => handleTouchStart(e, index)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                title="Drag to reorder"
              >
                ⠿
              </span>

              <button
                onClick={() => onToggle(todo.id)}
                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  todo.completed
                    ? 'bg-foreground border-foreground text-background'
                    : 'border-foreground/30 hover:border-foreground/60'
                }`}
              >
                {todo.completed && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              {editingId === todo.id ? (
                <input
                  type="text"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleEditKeyDown}
                  autoFocus
                  className="flex-1 bg-transparent border-b border-foreground/30 outline-none text-foreground py-0"
                />
              ) : (
                <span
                  onDoubleClick={() => startEditing(todo)}
                  className={`flex-1 cursor-text ${todo.completed ? 'line-through text-foreground/40' : ''}`}
                >
                  {todo.text}
                </span>
              )}
              <button
                onClick={() => onDelete(todo.id)}
                className="text-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}
