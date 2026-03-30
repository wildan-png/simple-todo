'use client';

import { useState, useEffect } from 'react';
import { Todo } from '@/app/types';
import TodoList from './TodoList';
import ChatAgent from './ChatAgent';

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('todos');
    if (stored) setTodos(JSON.parse(stored));
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos, loaded]);

  function addTodo(text: string) {
    setTodos(prev => [{ id: crypto.randomUUID(), text, completed: false }, ...prev]);
  }

  function toggleTodo(id: string) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  }

  function deleteTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));
  }

  function editTodo(id: string, text: string) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, text } : t));
  }

  // ID-based handlers (used by ChatAgent via tools)
  function toggleTodoById(id: string) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  }

  function deleteTodoById(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));
  }

  function renameTodoById(id: string, newText: string) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, text: newText } : t));
  }

  function reorderTodos(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setTodos(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }

  function reorderTodoById(id: string, position: number | 'top' | 'bottom') {
    setTodos(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);
      let target: number;
      if (position === 'top') target = 0;
      else if (position === 'bottom') target = updated.length;
      else target = Math.max(0, Math.min(position - 1, updated.length));
      updated.splice(target, 0, moved);
      return updated;
    });
  }

  function clearCompleted() {
    setTodos(prev => prev.filter(t => !t.completed));
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  return (
    <div className="w-full flex flex-col md:flex-row gap-6 md:flex-1">
      <div className="md:w-1/2 min-w-0">
        <TodoList
          todos={todos}
          input={input}
          setInput={setInput}
          onAdd={addTodo}
          onToggle={toggleTodo}
          onDelete={deleteTodo}
          onEdit={editTodo}
          onReorder={reorderTodos}
          dark={dark}
          onToggleTheme={toggleTheme}
        />
      </div>
      <div className="md:w-1/2 min-w-0 md:flex md:flex-col">
        <ChatAgent
          todos={todos}
          onAddTodo={addTodo}
          onToggleTodo={toggleTodoById}
          onDeleteTodo={deleteTodoById}
          onRenameTodo={renameTodoById}
          onReorderTodo={reorderTodoById}
          onClearCompleted={clearCompleted}
        />
      </div>
    </div>
  );
}
