'use client';

import { useState, useRef, useEffect } from 'react';
import { Todo, ChatMessage, TodoActionEvent } from '@/app/types';

interface ChatAgentProps {
  todos: Todo[];
  onAddTodo: (text: string) => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onRenameTodo: (id: string, newText: string) => void;
  onReorderTodo: (id: string, position: number | 'top' | 'bottom') => void;
  onClearCompleted: () => void;
}

export default function ChatAgent({ todos, onAddTodo, onToggleTodo, onDeleteTodo, onRenameTodo, onReorderTodo, onClearCompleted }: ChatAgentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function executeAction(event: TodoActionEvent) {
    if (event.type !== 'action') return;

    switch (event.action) {
      case 'add':
        if (event.text) onAddTodo(event.text);
        break;
      case 'toggle':
        if (event.id) onToggleTodo(event.id);
        break;
      case 'delete':
        if (event.id) onDeleteTodo(event.id);
        break;
      case 'rename':
        if (event.id && event.newText) onRenameTodo(event.id, event.newText);
        break;
      case 'reorder': {
        if (!event.id || !event.position) break;
        const pos = event.position.toLowerCase();
        if (pos === 'top' || pos === 'bottom') {
          onReorderTodo(event.id, pos);
        } else {
          const num = parseInt(pos, 10);
          if (!isNaN(num)) onReorderTodo(event.id, num);
        }
        break;
      }
      case 'clear_completed':
        onClearCompleted();
        break;
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, todos }),
      });

      if (!response.ok) {
        const err = await response.json();
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: err.error || 'Something went wrong.' };
          return updated;
        });
        setIsLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let displayText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event: TodoActionEvent = JSON.parse(line);
              if (event.type === 'text') {
                displayText += event.content;
                const current = displayText;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: current };
                  return updated;
                });
              } else if (event.type === 'action') {
                executeAction(event);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        if (buffer.trim()) {
          try {
            const event: TodoActionEvent = JSON.parse(buffer);
            if (event.type === 'text') {
              displayText += event.content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: displayText };
                return updated;
              });
            } else if (event.type === 'action') {
              executeAction(event);
            }
          } catch {
            // Skip
          }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Failed to connect to the AI assistant.' };
        return updated;
      });
    }

    setIsLoading(false);
  }

  return (
    <div className="w-full flex flex-col border border-foreground/10 rounded-lg overflow-hidden h-[400px] md:h-[calc(100vh-2rem)]">
      <div className="px-4 py-3 border-b border-foreground/10">
        <h2 className="font-semibold">AI Assistant</h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-foreground/40 text-sm text-center py-8">
            Ask me anything about your todos!
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-foreground text-background'
                  : 'bg-foreground/10'
              }`}
            >
              {msg.content || (isLoading && i === messages.length - 1 ? '...' : '')}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 p-3 border-t border-foreground/10">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about your todos..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-foreground/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
