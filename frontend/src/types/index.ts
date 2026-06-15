// TypeScript interfaces for ManimAI

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export type AppState =
  | 'greeting'
  | 'chatting'
  | 'ready_to_generate'
  | 'generating'
  | 'video_ready'
  | 'error';

export type GenerationStep =
  | 'idle'
  | 'generating_code'
  | 'code_ready'
  | 'rendering'
  | 'done';

export interface GenerationStatus {
  step: GenerationStep;
  message: string;
}

export interface VideoResult {
  videoId: string;
  videoUrl: string;
}

export interface ChatResponse {
  content: string;
  ready_to_generate: boolean;
}
