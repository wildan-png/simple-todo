import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { Todo, ChatMessage, TodoActionEvent } from '@/app/types';
import { claudeCodeProcessEnv } from '@/app/lib/claudeEnv';

function buildPrompt(todos: Todo[], messages: ChatMessage[]): string {
  const todoList = todos.length === 0
    ? 'The user has no todos yet.'
    : todos.map((t, i) => `${i + 1}. [${t.completed ? 'x' : ' '}] (id: ${t.id}) ${t.text}`).join('\n');

  const systemContext = `You are a helpful todo assistant. You help the user manage their tasks — add, complete, uncomplete, delete, rename, reorder, organize, and answer questions.

Current todo list:
${todoList}

You have tools to manage the todo list. Use them whenever the user asks to modify todos. Each existing todo has an "id" — always use the id when targeting a todo (not the text). Keep responses concise.

IMPORTANT: You are a simple chat assistant. Just respond with text and use the provided tools when needed.`;

  const history = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');

  return `${systemContext}\n\nConversation:\n${history}`;
}

function createTodoTools(todos: Todo[], actions: TodoActionEvent[]) {
  return createSdkMcpServer({
    name: 'todo-tools',
    tools: [
      tool('list_todos', 'Show all tasks with their status. Use when the user asks to see their todos.', {},
        async () => {
          if (todos.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No todos yet.' }] };
          }
          const list = todos.map((t, i) =>
            `${i + 1}. [${t.completed ? 'x' : ' '}] ${t.text}`
          ).join('\n');
          return { content: [{ type: 'text' as const, text: list }] };
        }
      ),

      tool('add_todo', 'Add a new task to the todo list', {
        text: z.string().describe('The task text to add'),
      },
        async ({ text }) => {
          actions.push({ type: 'action', action: 'add', text });
          return { content: [{ type: 'text' as const, text: `Added: "${text}"` }] };
        }
      ),

      tool('delete_todo', 'Remove a task by its id', {
        id: z.string().describe('The id of the todo to delete'),
      },
        async ({ id }) => {
          const todo = todos.find(t => t.id === id);
          if (!todo) return { content: [{ type: 'text' as const, text: `Todo not found.` }] };
          actions.push({ type: 'action', action: 'delete', id });
          return { content: [{ type: 'text' as const, text: `Deleted: "${todo.text}"` }] };
        }
      ),

      tool('rename_todo', 'Rename/edit a task', {
        id: z.string().describe('The id of the todo to rename'),
        new_text: z.string().describe('The new text for the todo'),
      },
        async ({ id, new_text }) => {
          const todo = todos.find(t => t.id === id);
          if (!todo) return { content: [{ type: 'text' as const, text: `Todo not found.` }] };
          actions.push({ type: 'action', action: 'rename', id, newText: new_text });
          return { content: [{ type: 'text' as const, text: `Renamed: "${todo.text}" → "${new_text}"` }] };
        }
      ),

      tool('toggle_todo', 'Mark a task as complete or incomplete (toggles the current state)', {
        id: z.string().describe('The id of the todo to toggle'),
      },
        async ({ id }) => {
          const todo = todos.find(t => t.id === id);
          if (!todo) return { content: [{ type: 'text' as const, text: `Todo not found.` }] };
          actions.push({ type: 'action', action: 'toggle', id });
          const newState = todo.completed ? 'incomplete' : 'complete';
          return { content: [{ type: 'text' as const, text: `Toggled: "${todo.text}" → ${newState}` }] };
        }
      ),

      tool('reorder_todo', 'Move a task to a new position in the list', {
        id: z.string().describe('The id of the todo to move'),
        position: z.string().describe('Target position: "top", "bottom", or a number (1 = first)'),
      },
        async ({ id, position }) => {
          const todo = todos.find(t => t.id === id);
          if (!todo) return { content: [{ type: 'text' as const, text: `Todo not found.` }] };
          actions.push({ type: 'action', action: 'reorder', id, position });
          return { content: [{ type: 'text' as const, text: `Moved: "${todo.text}" to position ${position}` }] };
        }
      ),

      tool('clear_completed', 'Remove all completed tasks from the list', {},
        async () => {
          const completedIds = todos.filter(t => t.completed).map(t => t.id);
          if (completedIds.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No completed todos to clear.' }] };
          }
          actions.push({ type: 'action', action: 'clear_completed', ids: completedIds });
          return { content: [{ type: 'text' as const, text: `Cleared ${completedIds.length} completed todo(s).` }] };
        }
      ),
    ],
  });
}

export async function POST(request: Request) {
  const { messages, todos } = (await request.json()) as {
    messages: ChatMessage[];
    todos: Todo[];
  };

  const prompt = buildPrompt(todos, messages);
  const actions: TodoActionEvent[] = [];
  const todoToolsServer = createTodoTools(todos, actions);

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: TodoActionEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };

      try {
        const session = query({
          prompt,
          options: {
            env: claudeCodeProcessEnv(),
            mcpServers: { 'todo-tools': todoToolsServer },
            allowedTools: [
              'mcp__todo-tools__list_todos',
              'mcp__todo-tools__add_todo',
              'mcp__todo-tools__delete_todo',
              'mcp__todo-tools__rename_todo',
              'mcp__todo-tools__toggle_todo',
              'mcp__todo-tools__reorder_todo',
              'mcp__todo-tools__clear_completed',
            ],
            maxTurns: 3,
          },
        });

        for await (const message of session) {
          if (message.type === 'assistant') {
            const content = message.message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === 'text' && block.text.trim()) {
                  send({ type: 'text', content: block.text });
                }
              }
            }
          }
        }

        // Send collected tool actions to client
        for (const action of actions) {
          send(action);
        }

        send({ type: 'done' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        send({ type: 'text', content: `[Error: ${msg}]` });
        send({ type: 'done' });
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  });
}
