export interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type TodoActionEvent =
  | { type: 'text'; content: string }
  | { type: 'action'; action: string; id?: string; text?: string; newText?: string; position?: string; ids?: string[] }
  | { type: 'done' };
