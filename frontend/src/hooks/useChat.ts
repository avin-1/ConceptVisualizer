// useChat — central state management hook for ManimAI

import { useState, useCallback, useRef } from 'react';
import type { Message, AppState, GenerationStatus, VideoResult } from '../types';
import { sendChatMessage, generateAnimation } from '../api/client';

// Inline uuid fallback if uuid package not available
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [appState, setAppState] = useState<AppState>('greeting');
  const [isTyping, setIsTyping] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null);
  const [videoResult, setVideoResult] = useState<VideoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const topicRef = useRef<string>('');

  const addMessage = useCallback((role: Message['role'], content: string): Message => {
    const msg: Message = {
      id: generateId(),
      role,
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isTyping) return;

    setError(null);

    // Track topic from first user message
    if (messages.length === 0) {
      topicRef.current = userText;
    }

    const userMsg = addMessage('user', userText);
    setIsTyping(true);
    setAppState('chatting');

    try {
      // Build history for API
      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await sendChatMessage(history);
      addMessage('assistant', response.content);

      if (response.ready_to_generate) {
        setAppState('ready_to_generate');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      addMessage('assistant', `Sorry, I ran into an error: ${msg}. Please try again.`);
    } finally {
      setIsTyping(false);
    }
  }, [messages, isTyping, addMessage]);

  const startGeneration = useCallback(async () => {
    setAppState('generating');
    setGenerationStatus({ step: 'generating_code', message: 'Starting...' });
    setVideoResult(null);
    setError(null);

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const topic = topicRef.current || 'mathematical concept';

    try {
      const result = await generateAnimation(
        history,
        topic,
        (status) => setGenerationStatus(status)
      );
      setVideoResult(result);
      setAppState('video_ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setError(msg);
      setAppState('error');
      setGenerationStatus(null);
    }
  }, [messages]);

  const resetForNew = useCallback(() => {
    setVideoResult(null);
    setGenerationStatus(null);
    setError(null);
    setAppState('ready_to_generate');
  }, []);

  const startFresh = useCallback(() => {
    setMessages([]);
    setVideoResult(null);
    setGenerationStatus(null);
    setError(null);
    setAppState('greeting');
    topicRef.current = '';
  }, []);

  return {
    messages,
    appState,
    isTyping,
    generationStatus,
    videoResult,
    error,
    sendMessage,
    startGeneration,
    resetForNew,
    startFresh,
  };
}
